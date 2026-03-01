<script>
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import { communityColor } from './colors.js';

  let { nodes, edges, secondaryEdges, meta, onhover } = $props();

  // ── Strip Discogs disambiguation suffixes e.g. "Chris Potter (2)" → "Chris Potter" ──
  function cleanName(name) {
    return name.replace(/\s*\(\d+\)$/, '');
  }

  // ── Pre-compute adjacency from original IDs ────────────────────────────────
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

  const rScale     = $derived(d3.scaleSqrt().domain([0, maxDeg]).range([4, 20]));
  const opacScale  = $derived(d3.scaleLinear().domain([1, maxWeight]).range([0.06, 0.55]).clamp(true));
  const widthScale = $derived(d3.scaleLinear().domain([1, maxWeight]).range([0.5, 3]).clamp(true));

  // Rank lookup (nodes arrive pre-sorted by degree descending)
  const rankOf      = $derived(new Map(nodes.map((n, i) => [n.id, i])));
  const ALWAYS_LABEL = $derived(new Set(nodes.slice(0, 25).map(n => n.id)));

  // Community entries we want to label (top 10, must have a label)
  const labeledCommunities = $derived(
    Object.entries(meta.communityLabel)
      .map(([id, name]) => Number(id))
      .filter(id => id < 10)
  );

  // ── D3 simulation copies ───────────────────────────────────────────────────
  const simNodes    = untrack(() => nodes.map(n => ({ ...n, displayName: cleanName(n.name) })));
  const simEdges    = untrack(() => edges.map(e => ({ ...e })));
  const simSecondary = untrack(() => secondaryEdges.map(e => ({ ...e })));

  // ── Reactive state ─────────────────────────────────────────────────────────
  let ticked    = $state(0);
  let xform     = $state('');
  let hoveredId = $state(null);
  let pinnedId  = $state(null);

  const activeId = $derived(pinnedId ?? hoveredId);
  const neighbourhood = $derived.by(() => {
    if (activeId === null) return null;
    const s = new Set([activeId]);
    adjMap.get(activeId)?.forEach(id => s.add(id));
    return s;
  });

  let svgEl;
  let simulation;

  // ── Mount ──────────────────────────────────────────────────────────────────
  onMount(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const initialT = d3.zoomIdentity.translate(W / 2, H / 2).scale(0.65);
    xform = `translate(${initialT.x},${initialT.y}) scale(${initialT.k})`;

    // Resolve secondary edges manually (not part of the force link)
    const nodeById = new Map(simNodes.map(n => [n.id, n]));
    for (const e of simSecondary) {
      e.source = nodeById.get(e.source) ?? e.source;
      e.target = nodeById.get(e.target) ?? e.target;
    }

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

  // ── Drag action ────────────────────────────────────────────────────────────
  function draggable(el, node) {
    const drag = d3.drag()
      .on('start', ev => {
        ev.sourceEvent.stopPropagation();
        if (!ev.active) simulation.alphaTarget(0.3).restart();
        node.fx = node.x; node.fy = node.y;
      })
      .on('drag',  ev => { node.fx = ev.x; node.fy = ev.y; })
      .on('end',   ev => {
        if (!ev.active) simulation.alphaTarget(0);
        node.fx = null; node.fy = null;
      });
    d3.select(el).call(drag);
    return { destroy() { d3.select(el).on('.drag', null); } };
  }

  // ── Position accessors ─────────────────────────────────────────────────────
  function nx(n)  { return ticked, n.x ?? 0; }
  function ny(n)  { return ticked, n.y ?? 0; }
  function ex1(e) { return ticked, e.source?.x ?? 0; }
  function ey1(e) { return ticked, e.source?.y ?? 0; }
  function ex2(e) { return ticked, e.target?.x ?? 0; }
  function ey2(e) { return ticked, e.target?.y ?? 0; }

  // ── Community centroid (for cluster labels) ────────────────────────────────
  function communityCenter(cId) {
    ticked; // reactive dependency
    const ns = simNodes.filter(n => n.community === cId);
    if (!ns.length) return null;
    return {
      x: ns.reduce((s, n) => s + (n.x ?? 0), 0) / ns.length,
      y: ns.reduce((s, n) => s + (n.y ?? 0), 0) / ns.length,
    };
  }

  // ── Visual helpers — soft dimming (network stays readable) ─────────────────
  // Resting opacity for non-highlighted elements is 0.3–0.4 not 0.06,
  // so the network shape is preserved during hover.

  function nodeOpacity(n) {
    if (!neighbourhood) return 1;
    return neighbourhood.has(n.id) ? 1 : 0.22;
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
      ? Math.min(base * 4, 0.85)
      : base * 0.18;
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
    return (neighbourhood.has(s) && neighbourhood.has(t)) ? 0.5 : 0.015;
  }

  function secondaryEdgeColor(e) {
    if (!neighbourhood) return '#5a4220';
    const s = e.source?.id ?? e.source;
    const t = e.target?.id ?? e.target;
    return (neighbourhood.has(s) && neighbourhood.has(t)) ? '#c8a030' : '#5a4220';
  }

  function labelOpacity(n) {
    if (neighbourhood) return neighbourhood.has(n.id) ? 1 : 0;
    return ALWAYS_LABEL.has(n.id) ? 0.8 : 0;
  }

  function labelSize(n) {
    const rank = rankOf.get(n.id) ?? 999;
    if (rank < 8)  return 12;
    if (rank < 20) return 10;
    return 9;
  }

  function clusterLabelOpacity(cId) {
    if (!neighbourhood) return 1;
    const activeNode = simNodes.find(n => n.id === activeId);
    return activeNode?.community === cId ? 1 : 0.25;
  }

  function nodeFill(n)   { return communityColor(n.community); }
  function nodeStroke(n) {
    const c = d3.color(communityColor(n.community));
    return c ? c.brighter(1.1).formatHex() : '#ffffff';
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  function enter(node) {
    if (!pinnedId) { hoveredId = node.id; onhover(node); }
  }
  function leave() {
    if (!pinnedId) { hoveredId = null; onhover(null); }
  }
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
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
      <feColorMatrix
        in="blur" type="matrix"
        values="0 0 0 0 0.96  0 0 0 0 0.78  0 0 0 0 0.09  0 0 0 12 -3"
        result="glow"
      />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <g transform={xform}>

    <!-- ── Cluster labels (bottom layer, behind everything) ────────────────── -->
    <g class="cluster-labels" pointer-events="none">
      {#each labeledCommunities as cId}
        {@const center = communityCenter(cId)}
        {#if center}
          <text
            x={center.x}
            y={center.y}
            class="cluster-label"
            text-anchor="middle"
            opacity={clusterLabelOpacity(cId)}
            fill={communityColor(cId)}
          >
            {meta.communityLabel[cId]}
          </text>
        {/if}
      {/each}
    </g>

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
          stroke-dasharray="2 4"
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

    <!-- ── Nodes ───────────────────────────────────────────────────────────── -->
    <g class="nodes">
      {#each simNodes as node (node.id)}
        <g
          class="node"
          role="button"
          tabindex="0"
          aria-label={node.displayName}
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
            stroke-width={1.2}
            stroke-opacity={0.5}
          />
          <text
            class="label"
            dy={rScale(node.degree) + 5}
            text-anchor="middle"
            font-size={labelSize(node)}
            opacity={labelOpacity(node)}
          >
            {node.displayName}
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

  .cluster-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    /* Painted wide and dim — geography-map style */
  }

  .label {
    fill: #c8b89a;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 500;
    pointer-events: none;
    paint-order: stroke;
    stroke: #0a0907;
    stroke-width: 3.5px;
    stroke-linejoin: round;
  }
</style>
