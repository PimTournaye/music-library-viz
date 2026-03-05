---
title: "Music Library Viz"
slug: "music-library-viz"
date: "2023"
status: "completed"
featured: false
primary_tag: "data-visualization"
tags:
  - "data-visualization"
  - "creative-coding"
  - "data-processing"
description: "A personal jazz library turned into a collaboration network — every musician a node, every shared album an edge. 435 musicians, 3,394 connections, one obsessive MusicBee export."
collaborators: []
links:
  - label: "Live demo"
    url: "https://music-library-viz.vercel.app"
  - label: "GitHub"
    url: "https://github.com/PimTournaye/music-library-viz"
---

## Overview

This started as a simple question: who are the most connected musicians in my jazz collection, and what does that say about how I listen?

The answer is a force-directed collaboration network built from a MusicBee library export. Every musician in the collection becomes a node. Every album they share with another musician creates an edge between them. Node size reflects how many unique small-ensemble collaborations a musician shows up in (not just raw album count — a big band appearance counts less than a quartet session). Community detection groups musicians into clusters by recording context: hard bop Blue Note regulars, Belgian contemporary jazz, free improvisation, post-bop, and so on.

The result is 435 musician nodes and 3,394 edges, drawn from 892 albums with full Discogs credit metadata. At the top: Wayne Shorter (65 connections), Ron Carter (63), Herbie Hancock (62).

## How It Was Made

The data pipeline starts from a raw MusicBee export (`library.json`, one row per track). A one-off script (`pipeline.js`) hit the Discogs API to match every album to its full musician credits via the `extraartists` field. This ran once and took hours — Discogs rate limits are brutal. The result is committed to the repo and not re-run lightly.

From there, `build-graph.js` is the interesting part. It:
- filters out non-performers by role (engineers, producers, mastering, A&R, liner notes, arrangers — blurry lines but a defensible blocklist)
- deduplicates credits per album by Discogs artist ID (same person listed as "Guitar" and "Producer" counts once)
- applies harmonic edge weighting: full credit for the first two shared albums between a pair, then 1/3, 1/4, etc. — so a fixed ensemble recording 10 albums together doesn't dominate the graph over a more cross-context collaborator
- runs Louvain community detection at resolution 1.5 to get 14 distinct communities, each color-coded

The visualization itself has three modes:

**Graph** — Force-directed layout rendered with PixiJS (WebGL) rather than SVG. At 435 nodes and 3,394 edges, SVG was too slow. Edges are bucketed into 6 weight tiers. On hover, non-neighbour edges drop to near-invisible; neighbourhood edges highlight gold.

**Arc Timeline** — Musicians laid out chronologically from 1954 to 2022 on an arc. D3 SVG. Shows how the collection is distributed across eras.

**Narrative** — Scrollytelling mode that walks through the collection as a personal story. Who I listened to first. How my mother's Keith Jarrett records eventually got through to me. Dexter Gordon on YouTube at 17. Elvin Jones obsession. Following threads from Brussels's jazz scene outward from one conversation at De Werf in Bruges.

## Technical Details

| | |
|---|---|
| **Frontend** | Svelte 5 (runes — `$state`, `$derived`, `$props`) + Vite |
| **Graph renderer** | PixiJS v7 (WebGL) + pixi-filters (GlowFilter) |
| **Layout & scales** | D3 v7 — force simulation, zoom/pan, SVG arc layout |
| **Graph data structure** | Graphology |
| **Community detection** | graphology-communities-louvain (Louvain, resolution 1.5) |
| **Data source** | Discogs API (`extraartists` credits) |

A few design decisions worth noting:

The harmonic weighting came out of a problem: ensembles like the Brussels Jazz Orchestra or Maria Schneider's orchestra form tight cliques because all members appear on every record together. Harmonic weighting compresses that without eliminating it — it's a real collaboration, just a different kind than a cross-context session pairing. Didn't fully solve the ensemble problem; it's an open one.

Wynton Marsalis was the canary in the coal mine for the data quality. An early version had him as the biggest node — clearly wrong. Tracing it back: he was appearing multiple times per album credit list, and non-musician roles weren't filtered. After deduplication and role filtering, he correctly sits at degree 6, connected to his own group.

The D3 + Svelte 5 reactivity pattern took some work: D3 mutates `x`/`y` on nodes directly (bypassing Svelte's reactivity), so the solution was a `ticked = $state(0)` counter incremented each sim tick, with position accessors using the comma operator to make template expressions reactive to `ticked` while reading D3-mutated values.

## Context

Started in March 2023 — a quick init and some data wrangling — then shelved. Picked up and rebuilt from scratch in March 2026: new stack (Svelte 5), proper data pipeline, all three views, the narrative mode. About a week of work, fast.

The Narrative mode exists because the graph alone doesn't explain why any of this matters. The collection has a specific shape — Miles Davis as gravitational center early on, Elvin Jones forming a second pole, the Belgian contemporary scene forming its own cluster much later — and that shape has a personal history attached to it. The scrollytelling is an attempt to make the data tell that story rather than just display it.

---

## Information Gaps

**Flagged for Pim:**
- [ ] Should this be marked `featured`? It's recent, personal, multi-view interactive — possibly a strong portfolio piece.
- [ ] The library data is self-described as stale in MEMORY.md. Worth noting in the note, or skip?
- [ ] Date: shows "2023" (init) but substantively it's a 2026 project. Prefer "2026" or "2023–2026"?
- [ ] The narrative references specific Discogs artist IDs (e.g. `focusIds: [97545]` = John Coltrane's Blue Train) — these are correct and tied to Discogs. Just confirming that's intentional and not a placeholder.
