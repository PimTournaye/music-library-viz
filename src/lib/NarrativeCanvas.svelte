<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { communityColor } from './colors.js';

  let {
    CW, CH, spineX,
    PAD_TOP, PAD_BOTTOM,
    timedNodes, nodePositions, nodeById, rScale,
    focusSet, contextSet, visibleEdges,
    activeStep, chainIds,
    yScale,
  } = $props();

  // ── Constants (canvas-specific) ───────────────────────────────────────────────
  const YEAR_MIN = 1954;
  const YEAR_MAX = 2022;

  const ERA_ANNOTATIONS = [
    { year: 1954, label: 'Hard Bop' },
    { year: 1959, label: 'Modal Jazz' },
    { year: 1965, label: 'Free Jazz' },
    { year: 1969, label: 'Electric Miles' },
    { year: 1975, label: 'Fusion' },
    { year: 1986, label: 'Neo-bop Revival' },
    { year: 1993, label: 'Young Lions' },
    { year: 2001, label: 'Post-bop / ECM' },
    { year: 2010, label: 'New Jazz' },
  ];

  const decadeTicks = [];
  for (let y = Math.ceil(YEAR_MIN / 10) * 10; y <= YEAR_MAX; y += 10) decadeTicks.push(y);

  // ── Internal state ────────────────────────────────────────────────────────────
  let svgEl = $state(null);
  let zoomStr = $state('translate(0,0) scale(1)');
  let zoomInstance = null;

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function srcId(e) { return typeof e.source === 'object' ? e.source.id : e.source; }
  function tgtId(e) { return typeof e.target === 'object' ? e.target.id : e.target; }

  function arcPath(s, t) {
    const ps = nodePositions.get(s), pt = nodePositions.get(t);
    if (!ps || !pt) return '';
    const dy = Math.abs(pt.y - ps.y);
    const bulge = Math.min(dy * 0.45, 200);
    return `M${ps.x},${ps.y} Q${spineX - bulge},${(ps.y + pt.y) / 2} ${pt.x},${pt.y}`;
  }

  // ── Exported: camera animation ────────────────────────────────────────────────
  export function animateCamera(step) {
    if (!svgEl || !zoomInstance || !nodePositions.size) return;
    const ids = step.cameraIds ?? step.focusIds;
    const pts = ids.map(id => nodePositions.get(id)).filter(Boolean);
    if (!pts.length) return;

    // Pan target: centroid of focus nodes
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    // Zoom anchor: fit the entire dataset, not just the focus nodes.
    // This keeps labels readable and the wider network always visible.
    // Include arc-bulge area (arcs curve up to 200px left of spine)
    // and label-clearance area to the right of nodes.
    const allPts = [...nodePositions.values()];
    const dataMinX = Math.min(...allPts.map(p => p.x)) - 200; // arc bulge
    const dataMaxX = Math.max(...allPts.map(p => p.x)) + 90;  // label clearance
    const dataMinY = Math.min(...allPts.map(p => p.y)) - 50;
    const dataMaxY = Math.max(...allPts.map(p => p.y)) + 50;
    const kFit = Math.min(CW / (dataMaxX - dataMinX), CH / (dataMaxY - dataMinY));

    // Slight zoom in (1.2×) from "see everything" — consistent across all steps.
    // The glow + colour contrast carry the emphasis; camera just navigates.
    const k = kFit * 1.2;

    d3.select(svgEl)
      .transition().duration(900).ease(d3.easeQuadInOut)
      .call(zoomInstance.transform, d3.zoomIdentity
        .translate(CW / 2 - k * cx, CH / 2 - k * cy)
        .scale(k));
  }

  // ── Focus label layout — column B with bidirectional bump ────────────────────
  // All labels land in a single column just right of the rightmost focus node.
  // Bidirectional bump from the cluster centroid keeps labels centred on the
  // cluster rather than all piling downward, which minimises leader-line length.
  const MIN_LABEL_GAP = 18; // data-space px; roughly 1 line-height at 0.72rem
  const focusLabelLayout = $derived.by(() => {
    const items = activeStep.focusIds
      .map(id => {
        const pos = nodePositions.get(id);
        const n   = nodeById.get(id);
        if (!pos || !n) return null;
        const r = rScale(n.sizeScore ?? n.connections);
        return { id, nodeX: pos.x, nodeY: pos.y, r };
      })
      .filter(Boolean);

    if (!items.length) return new Map();

    // Column x: right of every focus node's edge
    const colX = Math.max(...items.map(d => d.nodeX + d.r)) + 20;

    // Sort by natural y so leader lines never cross
    const sorted = [...items].sort((a, b) => a.nodeY - b.nodeY);
    const mid    = Math.floor(sorted.length / 2);
    const result = new Map();

    // ── Pass 1: downward from the middle item ─────────────────────────────────
    let lastY = -Infinity;
    for (let i = mid; i < sorted.length; i++) {
      const y = Math.max(sorted[i].nodeY, lastY + MIN_LABEL_GAP);
      result.set(sorted[i].id, { colX, labelY: y, nodeX: sorted[i].nodeX + sorted[i].r, nodeY: sorted[i].nodeY });
      lastY = y;
    }

    // ── Pass 2: upward from the middle item ───────────────────────────────────
    let nextY = result.get(sorted[mid].id).labelY;
    for (let i = mid - 1; i >= 0; i--) {
      const y = Math.min(sorted[i].nodeY, nextY - MIN_LABEL_GAP);
      result.set(sorted[i].id, { colX, labelY: y, nodeX: sorted[i].nodeX + sorted[i].r, nodeY: sorted[i].nodeY });
      nextY = y;
    }

    return result;
  });

  // ── D3 zoom ───────────────────────────────────────────────────────────────────
  onMount(() => {
    const zoom = d3.zoom()
      .scaleExtent([0.15, 8])
      .on('zoom', ev => {
        const t = ev.transform;
        zoomStr = `translate(${t.x},${t.y}) scale(${t.k})`;
        if (svgEl) svgEl.style.cursor = 'grabbing';
      })
      .on('end', () => { if (svgEl) svgEl.style.cursor = 'grab'; });

    zoomInstance = zoom;
    d3.select(svgEl).call(zoom).on('dblclick.zoom', null);

    return () => { if (svgEl) d3.select(svgEl).on('.zoom', null); };
  });
</script>

<div class="canvas-pane">

  <!-- Story encoding legend — bottom-left of canvas -->
  <aside class="story-enc-legend" aria-label="How to read this chart">
    <p class="story-enc-heading">How to read</p>
    <div class="story-enc-row">
      <span class="story-enc-dot" style="background:#b06800; opacity:1;"></span>
      <span class="story-enc-text">Story focus</span>
    </div>
    <div class="story-enc-row">
      <span class="story-enc-dot" style="background:#9a8878; opacity:0.5;"></span>
      <span class="story-enc-text">Connected musicians</span>
    </div>
    <div class="story-enc-row">
      <span class="story-enc-dot" style="background:#9a8878; opacity:0.18;"></span>
      <span class="story-enc-text">Rest of library</span>
    </div>
    <p class="story-enc-hint">Scroll or ↑↓ keys · drag to pan</p>
  </aside>

  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svgEl}
    width={CW}
    height={CH}
    style="display:block; cursor:grab;"
    role="img"
    aria-label="Temporal map of musician collaborations"
  >
    <defs>
      <linearGradient id="narBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#eee4d2" />
        <stop offset="100%" stop-color="#e6dac4" />
      </linearGradient>
      <marker id="chain-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <polygon points="0 0, 7 3.5, 0 7" fill="#b06800" fill-opacity="0.85" />
      </marker>
    </defs>

    <rect width={CW} height={CH} fill="url(#narBg)" />

    <!-- ── Zoomable data group ──────────────────────────────────────────────── -->
    <g transform={zoomStr}>

      <!-- Arcs -->
      <g pointer-events="none">
        {#each visibleEdges as e (srcId(e) + '|' + tgtId(e))}
          {@const s = srcId(e)}
          {@const t = tgtId(e)}
          {@const bothFocus = focusSet.has(s) && focusSet.has(t)}
          <path
            d={arcPath(s, t)}
            fill="none"
            stroke={bothFocus ? '#b06800' : '#9a7848'}
            stroke-opacity={bothFocus ? 0.65 : 0.20}
            stroke-width={bothFocus
              ? Math.min(Math.max(Math.log1p(e.weight) * 1.5, 1.2), 4)
              : 0.7}
          />
        {/each}
      </g>

      <!-- Ambient nodes (neither focus nor context) -->
      <g pointer-events="none">
        {#each timedNodes as n (n.id)}
          {#if !focusSet.has(n.id) && !contextSet.has(n.id)}
            {@const pos = nodePositions.get(n.id)}
            {#if pos}
              <circle
                cx={pos.x} cy={pos.y}
                r={rScale(n.sizeScore ?? n.connections)}
                fill="#9a8878"
                fill-opacity="0.04"
              />
            {/if}
          {/if}
        {/each}
      </g>

      <!-- Context nodes (1-hop neighbors of focus) -->
      <g pointer-events="none">
        {#each timedNodes as n (n.id)}
          {#if contextSet.has(n.id)}
            {@const pos = nodePositions.get(n.id)}
            {#if pos}
              <circle
                cx={pos.x} cy={pos.y}
                r={rScale(n.sizeScore ?? n.connections)}
                fill={communityColor(n.community)}
                fill-opacity="0.25"
              />
            {/if}
          {/if}
        {/each}
      </g>

      <!-- Focus nodes with glow rings -->
      <g pointer-events="none">
        {#each activeStep.focusIds as id (id)}
          {@const n = nodeById.get(id)}
          {@const pos = nodePositions.get(id)}
          {#if n && pos}
            {@const r = rScale(n.sizeScore ?? n.connections)}
            <circle cx={pos.x} cy={pos.y} r={r + 10} fill={communityColor(n.community)} fill-opacity="0.10" />
            <circle cx={pos.x} cy={pos.y} r={r + 5}  fill={communityColor(n.community)} fill-opacity="0.20" />
            <circle cx={pos.x} cy={pos.y} r={r}      fill={communityColor(n.community)} fill-opacity="1"    />
          {/if}
        {/each}
      </g>

      <!-- Focus labels — column layout, bidirectional bump, leader lines -->
      <g pointer-events="none">
        {#each activeStep.focusIds as id (id)}
          {@const n      = nodeById.get(id)}
          {@const layout = focusLabelLayout.get(id)}
          {#if n && layout}
            <line
              x1={layout.nodeX}     y1={layout.nodeY}
              x2={layout.colX - 6}  y2={layout.labelY}
              stroke="#9a7848" stroke-width="0.5" stroke-opacity="0.35"
            />
            <text x={layout.colX} y={layout.labelY + 4} class="node-label focus-label">{n.displayName}</text>
          {/if}
        {/each}
      </g>

      <!-- Chain arrow overlay -->
      {#if chainIds}
        {#each chainIds.slice(0, -1) as fromId, i}
          {@const toId = chainIds[i + 1]}
          {@const p0 = nodePositions.get(fromId)}
          {@const p1 = nodePositions.get(toId)}
          {#if p0 && p1}
            {@const dx = p1.x - p0.x}
            {@const dy = p1.y - p0.y}
            {@const len = Math.sqrt(dx*dx + dy*dy)}
            {@const ux = dx/len}
            {@const uy = dy/len}
            {@const r0 = rScale(nodeById.get(fromId)?.sizeScore ?? nodeById.get(fromId)?.connections ?? 1)}
            {@const r1 = rScale(nodeById.get(toId)?.sizeScore   ?? nodeById.get(toId)?.connections   ?? 1)}
            <line
              x1={p0.x + ux * (r0 + 12)}
              y1={p0.y + uy * (r0 + 12)}
              x2={p1.x - ux * (r1 + 14)}
              y2={p1.y - uy * (r1 + 14)}
              stroke="#b06800"
              stroke-opacity="0.85"
              stroke-width="1.5"
              stroke-dasharray="5 3"
              marker-end="url(#chain-arrow)"
            />
          {/if}
        {/each}
      {/if}

    </g><!-- end data group -->

    <!-- ── Axis layer (rendered on top, same zoom transform) ─────────────────── -->
    <g transform={zoomStr}>

      <line
        x1={spineX} x2={spineX}
        y1={PAD_TOP - 10} y2={CH - PAD_BOTTOM + 10}
        class="spine"
      />

      {#each decadeTicks as yr}
        {@const yy = yScale(yr)}
        <line x1={spineX - 36} x2={spineX} y1={yy} y2={yy} class="tick-line" />
        <text x={spineX - 44} y={yy + 4} text-anchor="end" class="tick-label">{yr}</text>
      {/each}

      <text x={spineX - 44} y={PAD_TOP - 18}         text-anchor="end" class="era-label">contemporary</text>
      <text x={spineX - 44} y={CH - PAD_BOTTOM + 30} text-anchor="end" class="era-label">roots</text>

      {#each ERA_ANNOTATIONS as { year, label }}
        {@const yy = yScale(year)}
        <line x1={spineX - 126} x2={spineX} y1={yy} y2={yy} class="era-ann-tick" />
        <text x={spineX - 130} y={yy + 4} text-anchor="end" class="era-ann-label">{label}</text>
      {/each}

    </g>

  </svg>
</div>

<style>
  /* ── Canvas pane ───────────────────────────────────────────────────────────── */
  .canvas-pane {
    position: relative;
    flex: 1;
    height: 100%;
    overflow: hidden;
  }

  /* ── Story encoding legend ─────────────────────────────────────────────────── */
  .story-enc-legend {
    position: absolute;
    bottom: 2rem;
    left: 1.5rem;
    pointer-events: none;
    user-select: none;
    background: rgba(238, 228, 210, 0.88);
    border: 1px solid #c0a870;
    border-radius: 4px;
    padding: 0.65rem 0.85rem;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    flex-direction: column;
    z-index: 5;
  }

  .story-enc-heading {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4a2a08;
    margin-bottom: 0.45rem;
  }

  .story-enc-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0;
  }

  .story-enc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .story-enc-text {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    color: #4a2e08;
    white-space: nowrap;
  }

  .story-enc-hint {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    color: #7a5020;
    margin-top: 0.45rem;
    font-style: italic;
  }

  /* ── SVG styles ────────────────────────────────────────────────────────────── */
  .spine {
    stroke: #9a7848;
    stroke-width: 1.5;
  }

  .tick-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.73rem;
    font-weight: 600;
    fill: #6a4820;
    letter-spacing: 0.04em;
    paint-order: stroke;
    stroke: rgba(238, 228, 210, 0.92);
    stroke-width: 4;
    stroke-linejoin: round;
  }

  .tick-line {
    stroke: #b09060;
    stroke-width: 1;
  }

  .era-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    fill: #3a2408;
  }

  .era-ann-tick {
    stroke: #c09860;
    stroke-width: 0.75;
    stroke-dasharray: 2 3;
  }

  .era-ann-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.65rem;
    font-style: italic;
    fill: #7a5828;
    paint-order: stroke;
    stroke: rgba(238, 228, 210, 0.92);
    stroke-width: 3.5;
    stroke-linejoin: round;
  }

  .node-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    fill: #281808;
    paint-order: stroke;
    stroke: rgba(238, 228, 210, 0.88);
    stroke-width: 3;
    stroke-linejoin: round;
  }

  .focus-label {
    font-weight: 600;
    font-size: 0.72rem;
    fill: #1a0c04;
  }
</style>
