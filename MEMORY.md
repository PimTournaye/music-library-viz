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

## Known issues / roadmap
- Library data is stale (needs re-fetch from desktop when possible)
- Duplicate albums in data.json (e.g. same album with slightly different titles from Discogs matching) — to fix properly, deduplicate by Discogs release ID not name
- Threshold slider in UI would be nice
- Community labels in legend could be more descriptive than just the top node's name
