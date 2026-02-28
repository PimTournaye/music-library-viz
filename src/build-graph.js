import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

const data = JSON.parse(readFileSync('data/data.json', 'utf-8'));

// ── Role filter ─────────────────────────────────────────────────────────────
// Blocklist approach: anything that starts with one of these is NOT a performer.
// We keep instruments, vocals, conductor, featuring, performer, etc.
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

// ── Config ───────────────────────────────────────────────────────────────────
const MIN_SHARED_ALBUMS = 3; // edges with fewer shared albums are dropped

// ── Build graph ──────────────────────────────────────────────────────────────
const musicians = new Map(); // discogsId → { id, name, albums: Set<albumDiscogsId> }
const collabs   = new Map(); // "idA|||idB" → { source, target, albums: Set<albumDiscogsId> }

for (const album of data) {
  if (!album.discoData?.credits?.length) continue;

  const albumId = album.discoData.id; // Discogs release/master ID — unique per release

  // Collect unique performers on this album, deduped by Discogs artist ID.
  // If the same person appears multiple times (e.g. Piano + Producer), they
  // count once as long as at least one of their roles passes the filter.
  const performers = new Map(); // artistId → { id, name }
  for (const credit of album.discoData.credits) {
    if (!isPerformer(credit.role)) continue;
    if (performers.has(credit.id)) continue;
    performers.set(credit.id, { id: credit.id, name: credit.name });
  }

  const list = [...performers.values()];

  // Register musicians
  for (const p of list) {
    if (!musicians.has(p.id)) {
      musicians.set(p.id, { id: p.id, name: p.name, albums: new Set() });
    }
    musicians.get(p.id).albums.add(albumId);
  }

  // Register pairwise collaborations (once per album, regardless of credit count)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i].id, list[j].id].sort((x, y) => x - y);
      const key = `${a}|||${b}`;
      if (!collabs.has(key)) {
        collabs.set(key, { source: a, target: b, albums: new Set() });
      }
      collabs.get(key).albums.add(albumId);
    }
  }
}

// ── Apply threshold ───────────────────────────────────────────────────────────
const edges = [...collabs.values()]
  .filter(c => c.albums.size >= MIN_SHARED_ALBUMS)
  .map(c => ({ source: c.source, target: c.target, weight: c.albums.size }));

const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]));

// Compute degree from the filtered edge set
const degree = new Map();
for (const e of edges) {
  degree.set(e.source, (degree.get(e.source) || 0) + 1);
  degree.set(e.target, (degree.get(e.target) || 0) + 1);
}

const nodes = [...musicians.values()]
  .filter(m => connectedIds.has(m.id))
  .map(m => ({
    id:         m.id,
    name:       m.name,
    albumCount: m.albums.size,
    degree:     degree.get(m.id) || 0,
  }))
  .sort((a, b) => b.degree - a.degree);

// ── Community detection (Louvain via Graphology) ──────────────────────────────
const gg = new Graph({ multi: false, type: 'undirected' });
nodes.forEach(n => gg.addNode(n.id, { name: n.name }));
edges.forEach(e => gg.addEdge(e.source, e.target, { weight: e.weight }));

// Louvain returns { nodeId: communityId }
const rawCommunities = louvain(gg, { resolution: 0.5 });

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

// Label each community after its highest-degree member
const communityLabel = {};
[...nodes].sort((a, b) => b.degree - a.degree).forEach(n => {
  if (communityLabel[n.community] === undefined) communityLabel[n.community] = n.name;
});

const communityCount = sortedCommunities.length;
console.log(`\nCommunities detected: ${communityCount}`);
Object.entries(communityLabel)
  .sort((a, b) => a[0] - b[0])
  .forEach(([id, name]) =>
    console.log(`  Community ${id}: ${name} (${communitySize[sortedCommunities[id]]} members)`)
  );

// ── Write output ──────────────────────────────────────────────────────────────
try { mkdirSync('public', { recursive: true }); } catch {}

const graph = {
  nodes,
  edges,
  meta: {
    threshold:      MIN_SHARED_ALBUMS,
    nodeCount:      nodes.length,
    edgeCount:      edges.length,
    communityCount,
    communityLabel,
    generated:      new Date().toISOString(),
  },
};

writeFileSync('public/graph.json', JSON.stringify(graph));

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\nGraph built (min ${MIN_SHARED_ALBUMS} shared albums):`);
console.log(`  ${nodes.length} musicians · ${edges.length} collaboration edges\n`);
console.log('Top 20 by connections:');
nodes.slice(0, 20).forEach((n, i) =>
  console.log(`  ${String(i + 1).padStart(2)}. ${n.name.padEnd(30)} ${String(n.degree).padStart(3)} connections · ${n.albumCount} albums · community ${n.community}`)
);
