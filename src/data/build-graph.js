import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

const data = JSON.parse(readFileSync('data/data.json', 'utf-8'));

// ── Constants ─────────────────────────────────────────────────────────────────
const MIN_CONTEXTS    = 2;  // musician must appear under ≥N distinct primary artists
const SMALL_GROUP_CAP = 20; // connections from albums with >N performers don't count toward sizeScore

// ── Role filter ─────────────────────────────────────────────────────────────
const BLOCKED_PREFIXES = [
  // Engineering / technical
  'recorded by', 'mixed by', 'mastered by', 'remastered by',
  'lacquer cut by', 'lacquer cut', 'cut by', 'transfer', 'engineer',
  'digital transfer', 'tape transfer', 'restoration',
  // Production
  'producer', 'co-producer', 'executive producer', 'executive-producer',
  'film producer',
  // A&R / business
  'a&r', 'management', 'manager', 'legal', 'business affairs',
  // Design / visual
  'design', 'art direction', 'artwork', 'layout', 'photography', 'photo',
  'illustration', 'cover', 'graphic', 'art by',
  // Text / liner material
  'liner notes', 'sleeve notes', 'written-by', 'written by', 'composed by',
  'text by', 'words by', 'annotation', 'essay by', 'notes by', 'notes',
  // Arrangement (composition, not performance)
  'arranged by', 'orchestrated by', 'transcribed by', 'translated by',
  // Business / label
  'distribution', 'manufacture', 'manufactured by', 'distributed by',
  'publicity', 'marketing', 'promotion', 'published by', 'publisher',
  'licensee', 'licensed by', 'copyright', 'publishing', 'press',
  // Administrative
  'coordinator', 'coordination', 'co-ordinated', 'administration',
  'administrator', 'supervisor', 'supervision', 'compiled by',
  'compilation', 'reissue', 'repackage', 'contractor', 'copyist',
  // Media / direction
  'director', 'film director', 'video director',
  // Creative (non-performance)
  'concept by', 'concept', 'creative director', 'music director',
  // Editing
  'editing', 'edited by',
];

function isPerformer(role) {
  const normalized = role.toLowerCase().split('[')[0].trim();
  return !BLOCKED_PREFIXES.some(blocked =>
    normalized === blocked ||
    normalized.startsWith(blocked + ' ') ||
    normalized.startsWith(blocked + ',')
  );
}

// ── Ensemble name filter ──────────────────────────────────────────────────────
// Discogs sometimes credits a performing ensemble as a unit (e.g. "Wayne Shorter Quartet"
// with role "Ensemble") alongside the individual members. Filter these phantom group
// credits by checking the credit name for known ensemble-type suffixes.
const ENSEMBLE_SUFFIXES = [
  'orchestra', 'quartet', 'quintet', 'trio', 'sextet', 'septet', 'octet',
  'ensemble', 'choir', 'chorus', 'big band', 'group',
];

function isEnsembleName(name) {
  const n = name.toLowerCase().replace(/\s*\(\d+\)$/, '').trim();
  return ENSEMBLE_SUFFIXES.some(s => n === s || n.endsWith(' ' + s));
}

// ── Year helpers ──────────────────────────────────────────────────────────────
function parseYear(released) {
  if (!released) return null;
  const y = parseInt(String(released).slice(0, 4), 10);
  return (y >= 1900 && y <= 2030) ? y : null;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// ── Build raw graph data ──────────────────────────────────────────────────────
const musicians        = new Map(); // id → { id, name, albums: Set }
const collabs          = new Map(); // "idA|||idB" → { source, target, albums: Set, minSize }
const musicianContexts = new Map(); // id → Set<album.artist>
const musicianYears    = new Map(); // id → number[]

for (const album of data) {
  if (!album.discoData?.credits?.length) continue;

  const albumId = album.discoData.id;

  // Collect unique performers on this album, deduped by Discogs artist ID.
  // Skip phantom ensemble-name credits (individual members are listed separately).
  const performers = new Map();
  for (const credit of album.discoData.credits) {
    if (!isPerformer(credit.role)) continue;
    if (isEnsembleName(credit.name)) continue;
    if (performers.has(credit.id)) continue;
    performers.set(credit.id, { id: credit.id, name: credit.name });
  }

  const list     = [...performers.values()];
  const albumSize = list.length;

  // Register musicians and track which primary artist contexts they appear under
  const albumYear = parseYear(album.discoData.released);
  for (const p of list) {
    if (!musicians.has(p.id)) {
      musicians.set(p.id, { id: p.id, name: p.name, albums: new Set() });
    }
    musicians.get(p.id).albums.add(albumId);

    if (!musicianContexts.has(p.id)) musicianContexts.set(p.id, new Set());
    musicianContexts.get(p.id).add(album.artist);

    if (albumYear !== null) {
      if (!musicianYears.has(p.id)) musicianYears.set(p.id, []);
      musicianYears.get(p.id).push(albumYear);
    }
  }

  // Register pairwise collaborations, tracking minimum album size per pair
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i].id, list[j].id].sort((x, y) => x - y);
      const key = `${a}|||${b}`;
      if (!collabs.has(key)) {
        collabs.set(key, { source: a, target: b, albums: new Set(), minSize: Infinity });
      }
      const c = collabs.get(key);
      c.albums.add(albumId);
      c.minSize = Math.min(c.minSize, albumSize);
    }
  }
}

// ── Context filter ────────────────────────────────────────────────────────────
// Keep only musicians who appeared on albums by ≥ MIN_CONTEXTS distinct primary
// artists. This removes musicians whose entire discography is within one outfit
// (e.g. a big band member who only ever recorded under that ensemble's name).
const contextQualified = new Set(
  [...musicianContexts.entries()]
    .filter(([, ctx]) => ctx.size >= MIN_CONTEXTS)
    .map(([id]) => id)
);

const qualifiedCollabs = [...collabs.values()]
  .filter(c => contextQualified.has(c.source) && contextQualified.has(c.target));

const connectedIds = new Set(qualifiedCollabs.flatMap(c => [c.source, c.target]));

// ── Edges ────────────────────────────────────────────────────────────────────
const edges = qualifiedCollabs.map(c => ({
  source: c.source,
  target: c.target,
  weight: c.albums.size,
  albums: [...c.albums],
}));

// ── Album metadata (id → { artist, title, year }) ─────────────────────────
const albumMeta = {};
for (const album of data) {
  const id = album.discoData?.id;
  if (id) {
      const rawYear = String(album.year || album.discoData.released || '');
      const yearMatch = rawYear.match(/\b(19|20)\d{2}\b/);
      albumMeta[id] = {
        artist: album.artist,
        title:  album.album,
        year:   yearMatch ? yearMatch[0] : null,
      };
  }
}

// ── Node metrics ──────────────────────────────────────────────────────────────
// connections = raw unique collaborator count (display in tooltip)
// sizeScore   = collaborators met via ≤ SMALL_GROUP_CAP-person albums (for node sizing)
//   This prevents large ensemble recordings (e.g. a 67-person super-session) from
//   inflating a musician's visual prominence beyond their actual network breadth.
const connections = new Map();
const sizeScore   = new Map();

for (const c of qualifiedCollabs) {
  connections.set(c.source, (connections.get(c.source) || 0) + 1);
  connections.set(c.target, (connections.get(c.target) || 0) + 1);
  if (c.minSize <= SMALL_GROUP_CAP) {
    sizeScore.set(c.source, (sizeScore.get(c.source) || 0) + 1);
    sizeScore.set(c.target, (sizeScore.get(c.target) || 0) + 1);
  }
}

const nodes = [...musicians.values()]
  .filter(m => connectedIds.has(m.id))
  .map(m => ({
    id:          m.id,
    name:        m.name,
    albumCount:  m.albums.size,
    connections: connections.get(m.id) || 0,
    sizeScore:   sizeScore.get(m.id) || 1,
    medianYear:  median((musicianYears.get(m.id) || []).filter(Boolean)),
  }))
  .sort((a, b) => b.connections - a.connections);

// ── Community detection (Louvain via Graphology) ──────────────────────────────
const gg = new Graph({ multi: false, type: 'undirected' });
nodes.forEach(n => gg.addNode(n.id, { name: n.name }));
edges.forEach(e => gg.addEdge(e.source, e.target, { weight: e.weight }));

const rawCommunities = louvain(gg, { resolution: 1.5 });

// Re-order community IDs so community 0 = largest group, etc.
const communitySize = {};
for (const cId of Object.values(rawCommunities)) {
  communitySize[cId] = (communitySize[cId] || 0) + 1;
}
const sortedCommunities = Object.entries(communitySize)
  .sort((a, b) => b[1] - a[1])
  .map(([id]) => Number(id));
const communityRemap = new Map(sortedCommunities.map((old, newId) => [old, newId]));

nodes.forEach(n => {
  n.community = communityRemap.get(rawCommunities[n.id]) ?? 0;
});

// ── Cross-community isolation filter ──────────────────────────────────────────
// Secondary safeguard: remove any remaining musicians with no cross-community edges.
// Run iteratively since removing a node may isolate others.
let filteredNodes = [...nodes];
let filteredEdges = [...edges];

let changed = true;
while (changed) {
  changed = false;
  const nodeCommMap = new Map(filteredNodes.map(n => [n.id, n.community]));
  const hasCrossComm = new Set();

  for (const e of filteredEdges) {
    const cA = nodeCommMap.get(e.source);
    const cB = nodeCommMap.get(e.target);
    if (cA !== cB) {
      hasCrossComm.add(e.source);
      hasCrossComm.add(e.target);
    }
  }

  const prevCount = filteredNodes.length;
  filteredNodes = filteredNodes.filter(n => hasCrossComm.has(n.id));

  if (filteredNodes.length < prevCount) {
    changed = true;
    const filteredIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(e => filteredIds.has(e.source) && filteredIds.has(e.target));
  }
}

// Label each community after its highest-connection member (from final node set)
const communityLabel = {};
[...filteredNodes].sort((a, b) => b.connections - a.connections).forEach(n => {
  if (communityLabel[n.community] === undefined) communityLabel[n.community] = n.name;
});

// ── Report + Write output ─────────────────────────────────────────────────────
const filteredCommSize = {};
filteredNodes.forEach(n => { filteredCommSize[n.community] = (filteredCommSize[n.community] || 0) + 1; });
const filteredCommunities = [...new Set(filteredNodes.map(n => n.community))].sort((a, b) => a - b);

try { mkdirSync('public', { recursive: true }); } catch {}

const graph = {
  nodes: filteredNodes,
  edges: filteredEdges,
  albumMeta,
  meta: {
    nodeCount:      filteredNodes.length,
    edgeCount:      filteredEdges.length,
    communityCount: filteredCommunities.length,
    communityLabel,
    generated:      new Date().toISOString(),
  },
};

writeFileSync('public/graph.json', JSON.stringify(graph));

const removedByContext = [...musicians.values()].filter(m => !contextQualified.has(m.id)).length;
const removedByIsolation = nodes.length - filteredNodes.length;

console.log(`\nGraph built:`);
console.log(`  ${filteredNodes.length} musicians · ${filteredEdges.length} edges`);
console.log(`  Removed ${removedByContext} single-context (ensemble-only) musicians`);
console.log(`  Removed ${removedByIsolation} further by cross-community isolation filter\n`);

console.log(`Communities: ${filteredCommunities.length}`);
filteredCommunities.forEach(id => {
  console.log(`  ${id}: ${communityLabel[id]} (${filteredCommSize[id]} members)`);
});

const nodesWithYear = filteredNodes.filter(n => n.medianYear != null).length;
console.log(`\n  ${nodesWithYear} of ${filteredNodes.length} nodes have medianYear`);

console.log('\nTop 20 by connections:');
filteredNodes.slice(0, 20).forEach((n, i) =>
  console.log(`  ${String(i+1).padStart(2)}. ${n.name.padEnd(30)} ${n.connections} collabs (size ${n.sizeScore}) · ${n.albumCount} albums · ${n.medianYear ?? '—'}`)
);
