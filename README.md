# music-library-viz

A personal project that turns a jazz-heavy music library into an interactive collaboration network. Every musician in the collection becomes a node; every shared album creates an edge between them. The bigger the node, the more people they've played with across the library.

Built by Pim. There are three views: a force-directed **Graph**, an **Arc Timeline** that lays musicians out chronologically from 1954 to 2022, and a **Narrative** mode that walks through the collection as a story.

---

## Live demo

> **URL:** _TBD — fill in here once deployed_

---

## Screenshots

> _Add screenshots here_

---

## Tech stack

| Library | Role |
|---|---|
| **Svelte 5** (runes) | UI framework — reactive state with `$state`, `$derived`, `$props` |
| **Vite 7** | Dev server and production bundler |
| **D3 v7** | Force simulation, zoom/pan, scales, SVG layout (Arc Timeline) |
| **PixiJS v7** | WebGL renderer for the Graph view — handles hundreds of nodes/edges at 60 fps |
| **pixi-filters v5** | `GlowFilter` for node highlight effects |
| **Graphology** | In-memory graph data structure used during graph building |
| **graphology-communities-louvain** | Louvain community detection (resolution 1.5 → 14 communities) |

---

## Project structure

```
src/
  main.js               # Svelte mount entry point
  App.svelte            # Root component — fetches graph.json, manages view mode & tooltip
  pipeline.js           # One-off data fetching script (Discogs API → data.json)
  build-graph.js        # Graph builder — runs from data.json, writes public/graph.json
  disco.js              # Discogs API client wrapper
  lib/
    Graph.svelte        # Force-directed graph (PixiJS + D3)
    ArcTimeline.svelte  # Chronological arc view (SVG + D3)
    Narrative.svelte    # Story / scrollytelling view
    Modal.svelte        # Album detail modal
    colors.js           # Community colour palette + yearColor() helper
    stories.js          # Narrative content
    components/
      Sidebar.svelte    # Left sidebar with mode switcher and stats
      Legend.svelte     # Community colour legend
      ModeSwitcher.svelte

data/
  library.json          # Raw library export (one row per track)
  data.json             # Processed: albums grouped + Discogs metadata (1 143 albums)
  albums.json           # Intermediate album list

public/
  graph.json            # Built graph — nodes, edges, community assignments (served at runtime)
```

---

## Data pipeline

```
Discogs API
    ↓  (pipeline.js — run once, very slow due to rate limits)
data/data.json          ← albums + full credit metadata from Discogs
    ↓  (build-graph.js — pnpm graph)
public/graph.json       ← nodes, edges, Louvain communities → loaded by the app at runtime
```

**`src/pipeline.js`** was the original one-off script that hit the Discogs API to pair each album with its musician credits (`extraartists`). It respects rate limits with manual delays. Don't re-run this lightly — it took hours. The result lives in `data/data.json` and is committed to the repo.

**`src/build-graph.js`** reads `data/data.json`, filters out non-performers (engineers, producers, designers, etc. via a role blocklist), deduplicates credits per album by Discogs artist ID, computes edges (shared album counts), runs Louvain community detection, and writes `public/graph.json`. This is the script you'll actually run when updating things.

**Graph stats (current build):** 435 musician nodes, 3 394 edges. Top nodes by collaborator count: Wayne Shorter (65), Ron Carter (63), Herbie Hancock (62), Chris Potter (59), Marcus Gilmore (57).

---

## Getting started

Requires [pnpm](https://pnpm.io/).

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Production build
pnpm build

# Preview the production build locally
pnpm preview
```

The app fetches `/graph.json` at runtime. In dev mode Vite serves it from `public/graph.json`. In production it just needs to be present in the build output (Vite copies `public/` automatically).

---

## Updating the data

If you add new albums to `data/data.json`, rebuild the graph with:

```bash
pnpm graph
```

This runs `node src/build-graph.js` and overwrites `public/graph.json`.

> ⚠️ **Hardcoded decade counts in the Timeline view**
>
> The annotation text displayed in the Arc Timeline (e.g. _"33 albums from the '50s & '60s, vs. 89 from the '70s & '80s…"_) is **hardcoded** in `src/lib/ArcTimeline.svelte` in the `MARGIN_NOTES` array (around line 232). After rebuilding `graph.json` with new albums, **update these numbers manually**, or implement dynamic counts by embedding decade stats into `graph.json` from `build-graph.js`.

---

## Versioning

A `2023` branch exists as a snapshot of the project at the end of 2023 — useful as a reference for how the graph and UI looked before the PixiJS rewrite and the community-detection overhaul.

---

## Licence

> _TBD — personal project, all rights reserved for now_
