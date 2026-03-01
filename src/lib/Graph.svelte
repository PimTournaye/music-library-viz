<script>
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import { communityColor } from './colors.js';

  let { nodes, edges, secondaryEdges, onhover } = $props();

  // ── Pre-compute adjacency from original IDs (before D3 mutates source/target) ──
  // Wrapped in $derived so Svelte knows these depend on the props.
  // In practice nodes/edges never change after mount, but this silences warnings.
  const adjMap = $derived.by(() => {
    const map = new Map();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source).add(e.target);
      map.get(e.target).add(e.source);
    }
    return map;
  });

  // ── Scales ─────────────────────────────────────────────────────────────────
  const maxDeg    = $derived(d3.max(nodes, n => n.degree));
  const maxWeight = $derived(d3.max(edges, e => e.weight));

  const rScale     = $derived(d3.scaleSqrt().domain([0, maxDeg]).range([3.5, 18]));
  const opacScale  = $derived(d3.scaleLinear().domain([1, maxWeight]).range([0.04, 0.48]).clamp(true));
  const widthScale = $derived(d3.scaleLinear().domain([1, maxWeight]).range([0.4, 2.5]).clamp(true));

  // Rank lookup for label size decisions (nodes come pre-sorted by degree).
  const rankOf     = $derived(new Map(nodes.map((n, i) => [n.id, i])));
  const ALWAYS_LABEL = $derived(new Set(nodes.slice(0, 30).map(n => n.id)));

  // ── D3 simulation copies (D3 adds x, y, vx, vy to these objects) ──────────
  // Snapshot the props once at mount time — intentionally non-reactive.
  const simNodes = untrack(() => nodes.map(n => ({ ...n })));
  const simEdges = untrack(() => edges.map(e => ({ ...e })));
  // Secondary edges: D3 will resolve source/target to node objects,
  // but they don't participate in the force layout — layout is driven by primary edges only.
  const simSecondary = untrack(() => secondaryEdges.map(e => ({ ...e })));

  // ── Reactive state ─────────────────────────────────────────────────────────
  let ticked      = $state(0);       // incremented each sim tick → drives re-render
  let xform       = $state('');      // SVG group transform string (zoom/pan)
  let hoveredId   = $state(null);
  let pinnedId    = $state(null);

  // Which node is "active" and which IDs are in its neighbourhood
  const activeId = $derived(pinnedId ?? hoveredId);
  const neighbourhood = $derived.by(() => {
    if (activeId === null) return null;
    const s = new Set([activeId]);
    adjMap.get(activeId)?.forEach(id => s.add(id));
    return s;
  });

  // ── Refs ───────────────────────────────────────────────────────────────────
  let svgEl;
  let simulation;

  // ── Mount ──────────────────────────────────────────────────────────────────
  onMount(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Initial transform
    const initialT = d3.zoomIdentity.translate(W / 2, H / 2).scale(0.65);
    xform = `translate(${initialT.x},${initialT.y}) scale(${initialT.k})`;

    // Resolve secondary edge source/target to node objects (needed to read x/y on tick).
    // They don't influence the layout — only primary edges do.
    const nodeById = new Map(simNodes.map(n => [n.id, n]));
    for (const e of simSecondary) {
      e.source = nodeById.get(e.source) ?? e.source;
      e.target = nodeById.get(e.target) ?? e.target;
    }

    // Force simulation
    simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges)
        .id(d => d.id)
        .distance(d => 55 + 75 / d.weight)
        .strength(0.4))
      .force('charge', d3.forceManyBody()
        .strength(d => -110 - d.degree * 9)
        .distanceMax(380))
      .force('center',  d3.forceCenter(0, 0).strength(0.08))
      .force('collide', d3.forceCollide().radius(d => rScale(d.degree) + 2.5).strength(0.7))
      .alphaDecay(0.013)
      .on('tick', () => { ticked++; });

    // Zoom / pan
    const zoom = d3.zoom()
      .scaleExtent([0.05, 10])
      .filter(ev => !(ev.type === 'dblclick'))
      .on('zoom', ev => {
        const t = ev.transform;
        xform = `translate(${t.x},${t.y}) scale(${t.k})`;
      });

    d3.select(svgEl)
      .call(zoom)
      .call(zoom.transform, initialT)
      .on('click.deselect', () => { pinnedId = null; hoveredId = null; onhover(null); });

    return () => simulation?.stop();
  });

  // ── Drag Svelte action ─────────────────────────────────────────────────────
  function draggable(el, node) {
    const drag = d3.drag()
      .on('start', ev => {
        ev.sourceEvent.stopPropagation();
        if (!ev.active) simulation.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', ev => {
        node.fx = ev.x;
        node.fy = ev.y;
      })
      .on('end', ev => {
        if (!ev.active) simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
      });
    d3.select(el).call(drag);
    return { destroy() { d3.select(el).on('.drag', null); } };
  }

  // ── Position accessors (reading ticked establishes reactive dependency) ────
  function nx(n)  { return ticked, n.x ?? 0; }
  function ny(n)  { return ticked, n.y ?? 0; }
  function ex1(e) { return ticked, e.source?.x ?? 0; }
  function ey1(e) { return ticked, e.source?.y ?? 0; }
  function ex2(e) { return ticked, e.target?.x ?? 0; }
  function ey2(e) { return ticked, e.target?.y ?? 0; }

  // ── Visual state per element ───────────────────────────────────────────────
  function nodeOpacity(n) {
    if (!neighbourhood) return 1;
    return neighbourhood.has(n.id) ? 1 : 0.06;
  }

  function nodeGlow(n) {
    if (!neighbourhood) return '';
    return n.id === activeId ? 'url(#glow)' : '';
  }

  function edgeOpacity(e) {
    const base = opacScale(e.weight);
    if (!neighbourhood) return base;
    const s = e.source?.id ?? e.source;
    const t = e.target?.id ?? e.target;
    return (neighbourhood.has(s) && neighbourhood.has(t))
      ? Math.min(base * 5, 0.85)
      : 0.012;
  }

  function edgeColor(e) {
    if (!neighbourhood) return '#c8922a';
    const s = e.source?.id ?? e.source;
    const t = e.target?.id ?? e.target;
    return (neighbourhood.has(s) && neighbourhood.has(t)) ? '#f5c518' : '#c8922a';
  }

  function secondaryEdgeOpacity(e) {
    if (!neighbourhood) return 0.06;
    const s = e.source?.id ?? e.source;
    const t = e.target?.id ?? e.target;
    return (neighbourhood.has(s) && neighbourhood.has(t)) ? 0.45 : 0.015;
  }

  function secondaryEdgeColor(e) {
    if (!neighbourhood) return '#7a6030';
    const s = e.source?.id ?? e.source;
    const t = e.target?.id ?? e.target;
    return (neighbourhood.has(s) && neighbourhood.has(t)) ? '#c8a030' : '#7a6030';
  }

  function labelOpacity(n) {
    if (neighbourhood) return neighbourhood.has(n.id) ? 1 : 0;
    return ALWAYS_LABEL.has(n.id) ? 1 : 0;
  }

  function labelSize(n) {
    const rank = rankOf.get(n.id) ?? 999;
    if (rank < 10) return 12;
    if (rank < 25) return 10;
    return 9;
  }

  function nodeFill(n)   { return communityColor(n.community); }
  function nodeStroke(n) { return d3.color(communityColor(n.community)).brighter(0.8).formatHex(); }

  // ── Interaction handlers ───────────────────────────────────────────────────
  function enter(node) { if (!pinnedId) { hoveredId = node.id; onhover(node); } }
  function leave()     { if (!pinnedId) { hoveredId = null;    onhover(null); } }
  function click(ev, node) {
    ev.stopPropagation();
    if (pinnedId === node.id) { pinnedId = null; hoveredId = null; onhover(null); }
    else                      { pinnedId = node.id; onhover(node); }
  }
</script>

<svg
  bind:this={svgEl}
  width={window.innerWidth}
  height={window.innerHeight}
>
  <defs>
    <!-- Warm glow for hovered / active node -->
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
      <feColorMatrix
        in="blur" type="matrix"
        values="0 0 0 0 0.96  0 0 0 0 0.78  0 0 0 0 0.09  0 0 0 14 -4"
        result="glow"
      />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <g transform={xform}>
    <!-- ── Secondary edges (ghost layer) ──────────────────────────────────── -->
    <g class="edges-secondary">
      {#each simSecondary as edge, i (i)}
        <line
          x1={ex1(edge)} y1={ey1(edge)}
          x2={ex2(edge)} y2={ey2(edge)}
          stroke={secondaryEdgeColor(edge)}
          stroke-opacity={secondaryEdgeOpacity(edge)}
          stroke-width={0.5}
          stroke-linecap="round"
          stroke-dasharray="2 3"
        />
      {/each}
    </g>

    <!-- ── Primary edges ───────────────────────────────────────────────────── -->
    <g class="edges">
      {#each simEdges as edge, i (i)}
        <line
          x1={ex1(edge)} y1={ey1(edge)}
          x2={ex2(edge)} y2={ey2(edge)}
          stroke={edgeColor(edge)}
          stroke-opacity={edgeOpacity(edge)}
          stroke-width={widthScale(edge.weight)}
          stroke-linecap="round"
        />
      {/each}
    </g>

    <!-- ── Nodes ─────────────────────────────────────────────────────────── -->
    <g class="nodes">
      {#each simNodes as node (node.id)}
        <g
          class="node"
          role="button"
          tabindex="0"
          aria-label={node.name}
          transform={`translate(${nx(node)},${ny(node)})`}
          opacity={nodeOpacity(node)}
          filter={nodeGlow(node)}
          use:draggable={node}
          onmouseenter={() => enter(node)}
          onmouseleave={() => leave()}
          onclick={(ev) => click(ev, node)}
          onkeydown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') click(ev, node); }}
        >
          <circle
            r={rScale(node.degree)}
            fill={nodeFill(node)}
            stroke={nodeStroke(node)}
            stroke-width={0.8}
            stroke-opacity={0.65}
          />
          <text
            class="label"
            dy={rScale(node.degree) + 5}
            text-anchor="middle"
            font-size={labelSize(node)}
            opacity={labelOpacity(node)}
          >
            {node.name}
          </text>
        </g>
      {/each}
    </g>
  </g>
</svg>

<style>
  svg {
    display: block;
    cursor: grab;
    user-select: none;
  }
  svg:active { cursor: grabbing; }

  .node { cursor: pointer; }

  .label {
    fill: #e8d5a3;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 500;
    pointer-events: none;
    /* Legible against any background */
    paint-order: stroke;
    stroke: #080808;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
</style>
