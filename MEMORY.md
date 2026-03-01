# Project Memory

## What this is
Visualization of a personal music library as a collaboration network graph. Jazz-heavy library. Biggest nodes = musicians with the most connections. Edge weight = number of shared albums.

## Stack
- **Svelte 5** (runes) + **Vite 7** for the frontend
- **D3 v7** for force simulation, zoom/pan, scales
- **Graphology** + `graphology-communities-louvain` for community detection (Louvain, resolution 0.5)
- Data sourced from **Discogs API** (`extraartists` credits field)

## Data pipeline
- `data/library.json` — raw music library (track-per-row, from music player export)
- `data/data.json` — processed: albums grouped, paired with Discogs metadata (1143 albums, 892 with credits)
- `public/graph.json` — built graph (nodes + edges + community assignments)
- `src/pipeline.js` — old data fetching script (don't re-run, API rate limits took hours)
- `src/build-graph.js` — graph builder, run with `pnpm graph`

## Key fixes made (vs old broken version)
- **Non-musician filtering**: blocklist of non-performer roles (engineer, mastering, A&R, design, liner notes, producer, etc.)
- **Deduplication per album**: same artist appearing multiple times in credits (different roles) counts as ONE collaborator per album, using Discogs artist ID
- **Edge weight = shared albums**: not credit entry products. Pair count is now "number of albums they appeared on together"
- **Threshold**: MIN_SHARED_ALBUMS = 3 (configurable in build-graph.js)
- **Wynton Marsalis**: was incorrectly the biggest node; now correctly degree 6 after fixes

## Graph output stats (threshold=3)
- 313 musicians, 852 edges
- Top nodes: Herbie Hancock (23), Keith O'Quinn/Maria Schneider Orchestra cluster (21), Pat Metheny (16)
- 31 communities detected; top 10 get distinct colors, rest are dim neutral (#3a3830)

## Community colors (colors.js)
0 gold #f5c518, 1 burnt orange #e8734a, 2 steel blue #5b9bd5, 3 sage #72b98c,
4 mauve #c47db5, 5 amber #e8c040, 6 violet #8a7cc5, 7 peach #e88c6a,
8 teal #5cb8b2, 9 copper #d4956a

## Frontend structure
```
src/
  main.js          — Svelte mount entry
  App.svelte       — loads graph.json, renders Graph + UI overlays (header, info panel, legend)
  lib/
    Graph.svelte   — D3 force simulation + SVG rendering, drag (d3.drag action), zoom (d3.zoom)
    colors.js      — community color palette + communityColor(id) util
style.css          — minimal global reset only; component styles in .svelte files
```

## D3 + Svelte 5 reactivity pattern used
- `simNodes`/`simEdges` = untracked snapshots of props (D3 mutates x/y on them)
- `ticked = $state(0)` incremented each sim tick
- Position accessors use comma operator: `function nx(n) { return ticked, n.x ?? 0; }`
- This makes template expressions reactive to `ticked` while reading D3-mutated values

## Scripts
- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm graph` — rebuild graph.json from data.json

## Graph design decisions & tradeoffs

### Role filtering (performer vs. non-performer)
Blocklist approach: anything starting with known non-performer prefixes is excluded.
Keeps instruments, vocals, conductor, featuring. Excludes engineer, producer, mastering,
A&R, design, liner notes, arranged by, etc.
**Tradeoff**: "Arranged By" is excluded even though jazz arrangers (e.g. Thad Jones) are
real artistic contributors. Kept out because they may not have *played* on the record.
"Producer" excluded even if it's a musician self-producing — they'll still appear via
their instrument credit on the same album.

### Deduplication by Discogs artist ID per album
Same person listed twice (Guitar + Producer) counts once. Uses numeric Discogs artist ID.
**Tradeoff**: different Discogs IDs for the same real person (rare but exists) would
create phantom duplicates. Accepted as rare enough not to matter.

### Threshold: minimum 3 shared albums for a primary edge
Below 3 = too noisy. Above 3 = loses real connections.
**Tradeoff**: misses some valid two-album collaborations, addressed by secondary edges.

### Harmonic edge weighting
weight = 1 + 1 + 1/3 + 1/4 + ... (full credit for first 2 albums, taper after)
**Why**: linear counting over-rewards musicians who had the opportunity to record many
albums with the same group (big bands, fixed ensembles). Logarithmic compression
makes the graph show *breadth* of collaboration rather than just *repetition*.
**Tradeoff**: slightly disadvantages musicians who worked in prolific recording scenes
(hard bop Blue Note era) vs. those in more selective contemporary contexts.
The "from album 3" taper is a judgment call — first two collaborations are treated
as equally intentional, then diminishing returns kick in.

### Two-tier edge system
- **Primary edges** (≥3 shared albums): solid lines, full visual weight
- **Secondary edges** (1–2 albums, only between nodes already in primary graph): faint
  dashed lines, nearly invisible at rest, light up on hover
**Why**: preserves the tight core graph while surfacing real but infrequent connections.
Wynton–Herbie share 1 album → secondary edge. Nathan Daems–Lander Gyselinck share 2 → secondary.
**Tradeoff**: secondary edges only appear between nodes already anchored by primary
connections. A musician who only ever played one-off sessions with established players
won't appear at all (no node). This is intentional — we want the established
collaboration network, not every session player who appeared once.
1241 secondary vs 852 primary edges. If visually too dense, drop secondary opacity
from 0.06 → 0.03 in `secondaryEdgeOpacity()` in Graph.svelte.

### Ensemble clusters (Brussels Jazz Orchestra, Maria Schneider, Snarky Puppy)
These form tight cliques because all members appear on multiple albums together.
Harmonic weighting compresses (but doesn't eliminate) this effect.
Still an open problem — the ensemble IS a real collaboration but it's a different
*kind* of collaboration than a cross-context session pairing.
Not solved yet. Possible future approaches: cap max edge weight per album-pair,
or add a "context diversity" score to node size.

### Wynton Marsalis isolation
Correctly reflects the library data: Wynton only shares 1 album with Herbie Hancock
("Quartet"). Now connected via secondary edge. His primary cluster (community 10)
is his own group (Branford, Kenny Kirkland, etc.) which is correct.

### Community detection (Louvain, resolution=0.5)
Lower resolution = fewer, larger communities. At 0.5 we get ~30 communities,
top 10 get distinct colors, rest are dim neutral. Louvain is non-deterministic
(slight variation between runs). Communities are relabeled by size (0 = largest).
Community labels in UI = highest-degree node in each community (rough heuristic).

## Known issues / roadmap
- Library data is stale (needs re-fetch from desktop when possible)
- Duplicate albums in data.json (e.g. same album with slightly different titles from Discogs matching) — to fix properly, deduplicate by Discogs release ID not name
- Threshold slider in UI would be nice
- Community labels in legend could be more descriptive than just the top node's name
