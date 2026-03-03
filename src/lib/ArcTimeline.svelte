<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { yearColor } from './colors.js';

  let { nodes, edges, meta, onhover } = $props();

  function cleanName(n)  { return n.replace(/\s*\(\d+\)$/, ''); }
  function srcId(e) { return typeof e.source === 'object' ? e.source.id : e.source; }
  function tgtId(e) { return typeof e.target === 'object' ? e.target.id : e.target; }
  function seededRandom(seed) {
    let s = ((seed * 2654435761) >>> 0) || 1;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  }

  // ── Layout constants ──────────────────────────────────────────────────────────
  const SPINE_X_RATIO = 0.36;
  const YEAR_MIN      = 1954;
  const YEAR_MAX      = 2022;
  const PAD_TOP       = 50;
  const PAD_BOTTOM    = 80;

  // ── Dimensions ───────────────────────────────────────────────────────────────
  let containerEl;
  let W = $state(window.innerWidth);
  let H = $state(window.innerHeight);
  function onResize() {
    if (containerEl) {
      W = containerEl.clientWidth;
      H = containerEl.clientHeight;
    }
  }

  // ── Interaction ───────────────────────────────────────────────────────────────
  let hoveredId = $state(null);
  let pinnedId  = $state(null);
  const activeId = $derived(pinnedId ?? hoveredId);

  // ── Entrance animation & zoom ─────────────────────────────────────────────────
  // revealY is the top edge of the SVG mask rect (screen coords).
  // Starts at H+60 (nothing visible), sweeps to -200 (everything visible).
  let revealY   = $state(99999);
  let zoomStr   = $state('translate(0,0) scale(1)');
  let svgEl     = $state(null);
  let resetZoom = $state(null);

  onMount(() => {
    // Initialize from container
    if (containerEl) {
      W = containerEl.clientWidth;
      H = containerEl.clientHeight;
    }

    let raf;
    let t0 = null;
    const dur   = 3500; // ms — slow, poetic reveal
    const delay = 250;  // ms — brief pause before starting

    function tick(now) {
      if (!t0) t0 = now;
      const elapsed = now - t0 - delay;
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(elapsed / dur, 1);
      // Sinusoidal ease-in-out: starts slow (roots emerge), surges through the decades,
      // slows again as it reaches the contemporary era
      const e = (1 - Math.cos(p * Math.PI)) / 2;
      revealY = (H + 60) - (H + 60 - (PAD_TOP - 60)) * e;
      if (p < 1) raf = requestAnimationFrame(tick);
      else revealY = -500;
    }
    raf = requestAnimationFrame(tick);

    // D3 zoom
    const zoom = d3.zoom()
      .scaleExtent([0.3, 6])
      .on('zoom', ev => {
        const t = ev.transform;
        zoomStr = `translate(${t.x},${t.y}) scale(${t.k})`;
        if (svgEl) svgEl.style.cursor = 'grabbing';
      })
      .on('end', () => { if (svgEl) svgEl.style.cursor = 'grab'; });

    d3.select(svgEl).call(zoom).on('dblclick.zoom', null);

    resetZoom = () => {
      d3.select(svgEl)
        .transition().duration(600).ease(d3.easeQuadInOut)
        .call(zoom.transform, d3.zoomIdentity);
    };

    return () => {
      cancelAnimationFrame(raf);
      resetZoom = null;
      if (svgEl) d3.select(svgEl).on('.zoom', null);
    };
  });

  // ── Data ─────────────────────────────────────────────────────────────────────
  const timedNodes = $derived(
    nodes
      .filter(n => n.medianYear != null)
      .map(n => ({ ...n, displayName: cleanName(n.name) }))
  );

  const adjMap = $derived.by(() => {
    const map = new Map();
    for (const e of edges) {
      const s = srcId(e), t = tgtId(e);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s).add(t); map.get(t).add(s);
    }
    return map;
  });

  const neighbourhood = $derived.by(() => {
    if (activeId === null) return null;
    const nb = new Set([activeId]);
    adjMap.get(activeId)?.forEach(id => nb.add(id));
    return nb;
  });

  // ── Scales ────────────────────────────────────────────────────────────────────
  const rScale = $derived(
    d3.scaleSqrt()
      .domain([d3.min(nodes, n => n.sizeScore ?? n.connections) ?? 1,
               d3.max(nodes, n => n.sizeScore ?? n.connections) ?? 1])
      .range([3, 16]).clamp(true)
  );

  // Node opacity varies by connection count — well-connected = more opaque
  const opacityScale = $derived(
    d3.scaleLinear()
      .domain([d3.min(nodes, n => n.connections) ?? 1,
               d3.max(nodes, n => n.connections) ?? 1])
      .range([0.30, 0.75]).clamp(true)
  );

  // INVERTED: 1954 at bottom (roots), 2022 at top (canopy)
  const yScale = $derived(
    d3.scaleLinear([YEAR_MIN, YEAR_MAX], [H - PAD_BOTTOM, PAD_TOP])
  );

  const spineX = $derived(W * SPINE_X_RATIO);

  // ── Force beeswarm (synchronous) ─────────────────────────────────────────────
  const nodePositions = $derived.by(() => {
    const sx = spineX, ys = yScale, rs = rScale;
    const sim = timedNodes.map(n => ({
      id: n.id, ss: n.sizeScore ?? n.connections, yr: n.medianYear,
      x: sx + 15 + seededRandom(n.id) * 90,
      y: ys(n.medianYear),
    }));
    d3.forceSimulation(sim)
      .force('y', d3.forceY(d => ys(d.yr)).strength(0.85))
      .force('x', d3.forceX(sx + 40).strength(0.10))   // stronger — keeps nodes right of spine
      .force('collide', d3.forceCollide(d => rs(d.ss) + 2.5).strength(0.9))
      .stop().tick(150);
    const pos = new Map();
    // Hard clamp: no node ever drifts into the axis lane
    sim.forEach(d => pos.set(d.id, { x: Math.max(d.x, sx + 5), y: d.y }));
    return pos;
  });

  // ── Edges ─────────────────────────────────────────────────────────────────────
  const visibleEdges = $derived(
    edges.filter(e => {
      const s = srcId(e), t = tgtId(e);
      return e.weight >= 2 && nodePositions.has(s) && nodePositions.has(t);
    })
  );

  // ── Labels ────────────────────────────────────────────────────────────────────
  const alwaysLabel = $derived(
    new Set([...timedNodes].sort((a, b) => b.connections - a.connections).slice(0, 20).map(n => n.id))
  );

  // Deconflicted label Y positions — greedy vertical bump to prevent overlap.
  // Sort always-labeled nodes by their computed y, then push each label down
  // if it would overlap the previous one. MIN_GAP matches the label font height.
  const MIN_LABEL_GAP = 13; // px — approx line height at 0.68rem
  const labelYMap = $derived.by(() => {
    const labeled = [...alwaysLabel]
      .map(id => ({ id, pos: nodePositions.get(id) }))
      .filter(d => d.pos)
      .sort((a, b) => a.pos.y - b.pos.y);

    const result = new Map();
    let lastY = -Infinity;
    for (const { id, pos } of labeled) {
      const y = Math.max(pos.y + 4, lastY + MIN_LABEL_GAP);
      result.set(id, y);
      lastY = y;
    }
    return result;
  });

  const decadeTicks = [];
  for (let y = Math.ceil(YEAR_MIN / 10) * 10; y <= YEAR_MAX; y += 10) decadeTicks.push(y);

  // Historical jazz era markers — annotated in the left margin between decade ticks
  const ERA_ANNOTATIONS = [
    { year: 1954, label: 'Hard Bop' },
    { year: 1959, label: 'Modal Jazz' },
    { year: 1965, label: 'Free Jazz' },
    { year: 1969, label: 'Electric Miles' },
    { year: 1975, label: 'Fusion' },
    { year: 1986, label: 'Neo-bop Revival' },
    { year: 1993, label: 'Acid Jazz' },
    { year: 2001, label: 'Post-bop / ECM' },
    { year: 2010, label: 'New Jazz' },
  ];

  // ── Arc path — control point anchored to spine, not node x ───────────────────
  function arcPath(s, t) {
    const ps = nodePositions.get(s), pt = nodePositions.get(t);
    if (!ps || !pt) return '';
    const dy = Math.abs(pt.y - ps.y);
    const bulge = Math.min(dy * 0.45, 200);
    return `M${ps.x},${ps.y} Q${spineX - bulge},${(ps.y + pt.y) / 2} ${pt.x},${pt.y}`;
  }

  function arcOpacity(w) { return 0.04 + Math.min(w / 12, 1) * 0.22; }

  // ── Interaction handlers ──────────────────────────────────────────────────────
  function handleOver(n, ev) {
    if (!pinnedId) { hoveredId = n.id; onhover(n, ev.clientX, ev.clientY); }
  }
  function handleOut() {
    if (!pinnedId) { hoveredId = null; onhover(null, 0, 0); }
  }
  function handleClick(n, ev) {
    if (pinnedId === n.id) { pinnedId = null; hoveredId = null; onhover(null, 0, 0); }
    else { pinnedId = n.id; onhover(n, ev.clientX, ev.clientY); }
  }
  function handleBackdrop(ev) {
    if (ev.target === ev.currentTarget) { pinnedId = null; hoveredId = null; onhover(null, 0, 0); }
  }
</script>

<svelte:window onresize={onResize} />

<div bind:this={containerEl} style="position:relative; width:100%; height:100%;">

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svgEl}
  width={W} height={H}
  style="display:block; cursor:grab;"
  onclick={handleBackdrop}
  role="img"
  aria-label="Arc timeline of musician collaborations"
>
  <defs>
    <!-- Warm parchment gradient — contrast-checked against all text colors below -->
    <linearGradient id="arcBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#eee4d2" />
      <stop offset="100%" stop-color="#e6dac4" />
    </linearGradient>

    <!-- Entrance reveal mask: single rect sweeping upward from bottom.
         Much cheaper than per-node opacity updates (1 element vs 432). -->
    <mask id="arcReveal">
      <rect x="-50" y={revealY} width={W + 100} height={Math.max(H - revealY + 300, 0)} fill="white" />
    </mask>
  </defs>

  <!-- Background (outside mask — always visible) -->
  <rect width={W} height={H} fill="url(#arcBg)" />

  <!-- ── DATA LAYER: zoomable + reveal mask ─────────────────────────────────── -->
  <g transform={zoomStr} mask="url(#arcReveal)">

    <!-- Arcs (pointer-events:none — hit layer handles interaction) -->
    <g pointer-events="none">
      {#each visibleEdges as e (srcId(e) + '|' + tgtId(e))}
        {@const s = srcId(e)}
        {@const t = tgtId(e)}
        {@const nb = neighbourhood}
        {@const inNb = nb && nb.has(s) && nb.has(t)}
        <path
          d={arcPath(s, t)}
          fill="none"
          stroke={inNb ? '#b06800' : '#9a6828'}
          stroke-opacity={nb ? (inNb ? 0.72 : 0.015) : arcOpacity(e.weight)}
          stroke-width={inNb ? Math.min(Math.max(Math.log1p(e.weight) * 1.5, 1.2), 4) : 0.7}
        />
      {/each}
    </g>

    <!-- Visual nodes (pointer-events:none → opacity changes can't cause flicker) -->
    <g pointer-events="none">
      {#each timedNodes as n (n.id)}
        {@const pos = nodePositions.get(n.id)}
        {#if pos}
          {@const r  = rScale(n.sizeScore ?? n.connections)}
          {@const nb = neighbourhood}
          {@const isActive = activeId === n.id}
          {#if isActive}
            <circle cx={pos.x} cy={pos.y} r={r + 10} fill="#b06800" fill-opacity="0.10" />
            <circle cx={pos.x} cy={pos.y} r={r + 5}  fill="#b06800" fill-opacity="0.20" />
          {/if}
          <circle
            cx={pos.x} cy={pos.y} r={r}
            fill={isActive ? yearColor(n.medianYear) : '#4a6a90'}
            class="visual-node"
            style="opacity:{nb ? (nb.has(n.id) ? Math.min(opacityScale(n.connections) * 1.4, 1) : 0.05) : opacityScale(n.connections)};"
          />
        {/if}
      {/each}
    </g>

    <!-- Labels — y uses deconflicted labelYMap for always-on labels;
         hover/pin labels use raw pos.y (only 1 node active at once, no collision) -->
    <g pointer-events="none">
      {#each timedNodes as n (n.id)}
        {@const pos = nodePositions.get(n.id)}
        {#if pos}
          {@const nb   = neighbourhood}
          {@const show = nb ? nb.has(n.id) : alwaysLabel.has(n.id)}
          {#if show}
            {@const r    = rScale(n.sizeScore ?? n.connections)}
            {@const labelY = nb ? pos.y + 4 : (labelYMap.get(n.id) ?? pos.y + 4)}
            <!-- Connector tick from node to label when label has been bumped -->
            {#if !nb && Math.abs(labelY - (pos.y + 4)) > 3}
              <line
                x1={pos.x + r + 3} y1={pos.y}
                x2={pos.x + r + 5} y2={labelY}
                stroke="#9a7848" stroke-width="0.5" stroke-opacity="0.4"
              />
            {/if}
            <text
              x={pos.x + r + 7} y={labelY}
              class="node-label"
              opacity={nb ? 1 : 0.75}
            >{n.displayName}</text>
          {/if}
        {/if}
      {/each}
    </g>

    <!-- Hit layer — transparent, never changes based on hover state.
         Keeping this separate from visual nodes is the key to flicker-free hover:
         DOM patches to visual opacity never touch these circles. -->
    <g>
      {#each timedNodes as n (n.id)}
        {@const pos = nodePositions.get(n.id)}
        {#if pos}
          {@const r = rScale(n.sizeScore ?? n.connections)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <circle
            cx={pos.x} cy={pos.y} r={r + 6}
            fill="transparent"
            style="cursor:pointer;"
            onpointerover={ev => handleOver(n, ev)}
            onpointerout={handleOut}
            onclick={ev => { ev.stopPropagation(); handleClick(n, ev); }}
          />
        {/if}
      {/each}
    </g>
  </g>

  <!-- ── AXIS LAYER: same zoom transform but NOT masked, rendered on top ────── -->
  <!-- Drawn last so axis always renders above nodes and arcs. No backdrop needed:
       tick labels have a halo stroke, and nodes are clamped right of the spine. -->
  <g transform={zoomStr}>

    <!-- Spine -->
    <line
      x1={spineX} x2={spineX}
      y1={PAD_TOP - 10} y2={H - PAD_BOTTOM + 10}
      class="spine"
    />

    <!-- Decade ticks + labels -->
    {#each decadeTicks as yr}
      {@const yy = yScale(yr)}
      <line x1={spineX - 36} x2={spineX} y1={yy} y2={yy} class="tick-line" />
      <text x={spineX - 44} y={yy + 4} text-anchor="end" class="tick-label">{yr}</text>
    {/each}

    <!-- Era endpoint labels -->
    <text x={spineX - 44} y={PAD_TOP - 18}        text-anchor="end" class="era-label">contemporary</text>
    <text x={spineX - 44} y={H - PAD_BOTTOM + 30} text-anchor="end" class="era-label">roots</text>

    <!-- Era annotations — italic labels between decade ticks with short dashed tick -->
    {#each ERA_ANNOTATIONS as { year, label }}
      {@const yy = yScale(year)}
      <line x1={spineX - 22} x2={spineX} y1={yy} y2={yy} class="era-ann-tick" />
      <text x={spineX - 26} y={yy + 4} text-anchor="end" class="era-ann-label">{label}</text>
    {/each}
  </g>
</svg>

<button class="zoom-reset" onclick={() => resetZoom?.()} aria-label="Reset zoom">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 1v2.5M7 13v-2.5M1 7h2.5M13 7h-2.5M3.2 3.2l1.77 1.77M9.03 9.03l1.77 1.77M10.8 3.2L9.03 4.97M4.97 9.03L3.2 10.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>
</button>

</div>

<style>
  .zoom-reset {
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    border: 1px solid #9a7040;
    background: rgba(238, 228, 210, 0.88);
    color: #5a3a10;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .zoom-reset:hover {
    background: rgba(238, 228, 210, 1);
    border-color: #b06800;
    color: #3a2008;
  }

  .spine {
    stroke: #9a7848;
    stroke-width: 1.5;
  }

  .tick-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.73rem; font-weight: 600;
    fill: #6a4820;           /* contrast ~5.8:1 on #eee4d2 ✓ */
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
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    fill: #3a2408;      /* contrast ~11:1 on #eee4d2 ✓ */
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

  /* CSS transitions on opacity/fill prevent abrupt changes from
     causing false SVG pointer events on the now-separate hit layer */
  .visual-node {
    transition: opacity 0.14s ease, fill 0.14s ease;
  }

  .node-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    fill: #281808;           /* contrast ~13:1 on #eee4d2 ✓ */
    paint-order: stroke;
    stroke: rgba(238, 228, 210, 0.88);
    stroke-width: 3;
    stroke-linejoin: round;
  }

</style>
