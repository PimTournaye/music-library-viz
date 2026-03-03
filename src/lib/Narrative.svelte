<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { communityColor } from './colors.js';
  import { STORIES } from './stories.js';

  let { nodes, edges, meta, onhover, onviewchange } = $props();

  function cleanName(n) { return n.replace(/\s*\(\d+\)$/, ''); }
  function srcId(e) { return typeof e.source === 'object' ? e.source.id : e.source; }
  function tgtId(e) { return typeof e.target === 'object' ? e.target.id : e.target; }
  function seededRandom(seed) {
    let s = ((seed * 2654435761) >>> 0) || 1;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  }

  // ── Layout constants (matches ArcTimeline) ───────────────────────────────────
  const YEAR_MIN   = 1954;
  const YEAR_MAX   = 2022;
  const PAD_TOP    = 116; // 52px header + 64px breathing room
  const PAD_BOTTOM = 80;

  // Canvas is the right 70%; spine is relative to canvas width
  const SPINE_X_RATIO = 0.30;

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

  // ── State ─────────────────────────────────────────────────────────────────────
  let W = $state(window.innerWidth);
  let H = $state(window.innerHeight);
  function onResize() { W = window.innerWidth; H = window.innerHeight; }

  let activeStoryIdx = $state(0);
  let activeStepIdx  = $state(0);
  let svgEl          = $state(null);
  let zoomStr        = $state('translate(0,0) scale(1)');
  let zoomInstance   = null;

  // Step card elements for IntersectionObserver
  let stepCardEls = $state([]);

  const activeStory = $derived(STORIES[activeStoryIdx]);
  const activeStep  = $derived(activeStory.steps[activeStepIdx]);

  // ── Canvas dimensions (right 70%) ─────────────────────────────────────────────
  const HEADER_H = 52;
  const CW = $derived(W * 0.7);          // canvas width
  const CH = $derived(H - HEADER_H);    // canvas height (below fixed header)
  const spineX = $derived(CW * SPINE_X_RATIO);

  // ── Data prep ─────────────────────────────────────────────────────────────────
  const timedNodes = $derived(
    nodes
      .filter(n => n.medianYear != null)
      .map(n => ({ ...n, displayName: cleanName(n.name) }))
  );

  const nodeById = $derived(new Map(timedNodes.map(n => [n.id, n])));

  const adjMap = $derived.by(() => {
    const map = new Map();
    for (const e of edges) {
      const s = srcId(e), t = tgtId(e);
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s).add(t);
      map.get(t).add(s);
    }
    return map;
  });

  // ── Scales ────────────────────────────────────────────────────────────────────
  const rScale = $derived(
    d3.scaleSqrt()
      .domain([d3.min(nodes, n => n.sizeScore ?? n.connections) ?? 1,
               d3.max(nodes, n => n.sizeScore ?? n.connections) ?? 1])
      .range([3, 16]).clamp(true)
  );

  const yScale = $derived(
    d3.scaleLinear([YEAR_MIN, YEAR_MAX], [CH - PAD_BOTTOM, PAD_TOP])
  );

  // ── Force beeswarm (synchronous, same as ArcTimeline) ─────────────────────────
  const nodePositions = $derived.by(() => {
    const sx = spineX, ys = yScale, rs = rScale;
    const sim = timedNodes.map(n => ({
      id: n.id, ss: n.sizeScore ?? n.connections, yr: n.medianYear,
      x: sx + 15 + seededRandom(n.id) * 90,
      y: ys(n.medianYear),
    }));
    d3.forceSimulation(sim)
      .force('y', d3.forceY(d => ys(d.yr)).strength(0.85))
      .force('x', d3.forceX(sx + 40).strength(0.10))
      .force('collide', d3.forceCollide(d => rs(d.ss) + 2.5).strength(0.9))
      .stop().tick(150);
    const pos = new Map();
    sim.forEach(d => pos.set(d.id, { x: Math.max(d.x, sx + 5), y: d.y }));
    return pos;
  });

  // ── Decade ticks ──────────────────────────────────────────────────────────────
  const decadeTicks = [];
  for (let y = Math.ceil(YEAR_MIN / 10) * 10; y <= YEAR_MAX; y += 10) decadeTicks.push(y);

  // ── Focus / context sets for current step ─────────────────────────────────────
  const focusSet = $derived(new Set(activeStep.focusIds));

  const contextSet = $derived.by(() => {
    const ctx = new Set();
    for (const id of focusSet) {
      adjMap.get(id)?.forEach(nb => {
        if (!focusSet.has(nb)) ctx.add(nb);
      });
    }
    return ctx;
  });

  // ── Visible edges: touch at least one focus node ──────────────────────────────
  const visibleEdges = $derived(
    edges.filter(e => {
      const s = srcId(e), t = tgtId(e);
      if (!nodePositions.has(s) || !nodePositions.has(t)) return false;
      if (!focusSet.has(s) && !focusSet.has(t)) return false; // exclude context↔context
      return (focusSet.has(s) || contextSet.has(s)) && (focusSet.has(t) || contextSet.has(t));
    })
  );

  // ── Chain arrows for special steps ────────────────────────────────────────────
  const chainIds = $derived(activeStep.chainIds ?? null);

  // ── Arc path ──────────────────────────────────────────────────────────────────
  function arcPath(s, t) {
    const ps = nodePositions.get(s), pt = nodePositions.get(t);
    if (!ps || !pt) return '';
    const dy = Math.abs(pt.y - ps.y);
    const bulge = Math.min(dy * 0.45, 200);
    return `M${ps.x},${ps.y} Q${spineX - bulge},${(ps.y + pt.y) / 2} ${pt.x},${pt.y}`;
  }

  // ── Camera animation ──────────────────────────────────────────────────────────
  function animateCamera(step) {
    if (!svgEl || !zoomInstance || !nodePositions.size) return;
    const ids = step.cameraIds ?? step.focusIds;
    const pts = ids.map(id => nodePositions.get(id)).filter(Boolean);
    if (!pts.length) return;

    const pad = 120;
    const x0 = Math.min(...pts.map(p => p.x)) - pad;
    const x1 = Math.max(...pts.map(p => p.x)) + pad;
    const y0 = Math.min(...pts.map(p => p.y)) - pad;
    const y1 = Math.max(...pts.map(p => p.y)) + pad;

    const bw = x1 - x0, bh = y1 - y0;
    const kx = CW / bw, ky = CH / bh;
    const k  = Math.min(kx, ky, 3.5);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const tx = CW / 2 - k * cx;
    const ty = CH / 2 - k * cy;

    d3.select(svgEl)
      .transition().duration(900).ease(d3.easeQuadInOut)
      .call(zoomInstance.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  // Watch activeStep → animate camera
  $effect(() => {
    const step = activeStep;
    // Small timeout so layout is computed first
    const t = setTimeout(() => animateCamera(step), 50);
    return () => clearTimeout(t);
  });

  // ── Story switch: reset scroll + step + camera ────────────────────────────────
  function switchStory(idx) {
    if (idx === activeStoryIdx) return;
    activeStoryIdx = idx;
    activeStepIdx  = 0;
    if (storyPaneEl) storyPaneEl.scrollTop = 0;
  }

  // ── Jump to a specific step (from progress dots) ──────────────────────────────
  function jumpToStep(idx) {
    activeStepIdx = idx;
    const el = stepCardEls[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  let storyPaneEl = $state(null);

  // ── IntersectionObserver for scroll-driven step activation ───────────────────
  $effect(() => {
    const cards = stepCardEls;
    if (!cards.length) return;

    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.stepIdx);
          if (!isNaN(idx)) activeStepIdx = idx;
        }
      }
    }, { threshold: 0.55, root: storyPaneEl });

    cards.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  });

  // ── D3 zoom setup ─────────────────────────────────────────────────────────────
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

    // Initial camera — slight delay for beeswarm to settle
    setTimeout(() => animateCamera(activeStep), 100);

    return () => {
      if (svgEl) d3.select(svgEl).on('.zoom', null);
    };
  });
</script>

<svelte:window onresize={onResize} />

<div class="narrative-wrapper">

  <!-- ── Story pane (left 30%) ────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="story-pane"
    bind:this={storyPaneEl}
    role="region"
    aria-label="Story navigation"
  >

    <!-- Story tabs + step progress (all sticky) -->
    <div class="story-tabs">
      {#each STORIES as story, i}
        <button
          class="story-tab"
          class:active={i === activeStoryIdx}
          onclick={() => switchStory(i)}
        >
          <span class="tab-title">{story.title}</span>
          <span class="tab-sub">{story.subtitle}</span>
        </button>
      {/each}

      <!-- Step progress: sticky with tabs so always visible -->
      <div class="step-progress" role="group" aria-label="Story progress">
        {#each activeStory.steps as _, i}
          <button
            class="step-dot"
            class:active={i === activeStepIdx}
            onclick={() => jumpToStep(i)}
            aria-label="Go to step {i + 1}"
          ></button>
        {/each}
        <span class="step-progress-label">{activeStepIdx + 1} / {activeStory.steps.length}</span>
      </div>
    </div>

    <!-- Step cards -->
    {#each activeStory.steps as step, i}
      <div
        class="step-card"
        class:active={i === activeStepIdx}
        data-step-idx={i}
        bind:this={stepCardEls[i]}
      >
        <div class="step-inner">
          <p class="step-num">{String(i + 1).padStart(2, '0')}</p>
          <h2 class="step-heading">{step.heading}</h2>
          {#if step.callout}
            <p class="step-callout">{step.callout}</p>
          {/if}
          <!-- Musician chips -->
          <div class="musician-chips">
            {#each step.focusIds as id}
              {@const n = nodeById.get(id)}
              {#if n}
                {@const color = communityColor(n.community)}
                <div class="musician-chip" style="border-color: {color}80; background: {color}14;">
                  <span class="chip-dot" style="background: {color};"></span>
                  <span class="chip-name">{n.displayName}</span>
                  <span class="chip-collabs">{n.connections} total collabs</span>
                </div>
              {/if}
            {/each}
          </div>
          <p class="step-body">{step.body}</p>
        </div>
      </div>
    {/each}

    <!-- End-of-story navigation -->
    <div class="story-end">
      {#if activeStoryIdx < STORIES.length - 1}
        <p class="story-end-label">Next story</p>
        <button class="nav-btn nav-btn-primary" onclick={() => switchStory(activeStoryIdx + 1)}>
          {STORIES[activeStoryIdx + 1].title} →
        </button>
        <p class="story-end-label" style="margin-top:1rem;">Or explore freely</p>
      {:else}
        <p class="story-end-label">Continue exploring</p>
      {/if}
      <button class="nav-btn" onclick={() => onviewchange('graph')}>Network view</button>
      <button class="nav-btn" onclick={() => onviewchange('timeline')}>Timeline view</button>
    </div>

  </div>

  <!-- ── Canvas pane (right 70%) ──────────────────────────────────────────────── -->
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
      <p class="story-enc-hint">Scroll to advance · drag to pan</p>
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
        <!-- Arrow marker for chain overlay -->
        <marker id="chain-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="#b06800" fill-opacity="0.85" />
        </marker>
      </defs>

      <!-- Background -->
      <rect width={CW} height={CH} fill="url(#narBg)" />

      <!-- ── Data group: zoomable ────────────────────────────────────────────── -->
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

        <!-- Ambient nodes (not focus, not context) -->
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

        <!-- Focus nodes -->
        <g pointer-events="none">
          {#each activeStep.focusIds as id (id)}
            {@const n = nodeById.get(id)}
            {@const pos = nodePositions.get(id)}
            {#if n && pos}
              {@const r = rScale(n.sizeScore ?? n.connections)}
              <!-- Glow rings -->
              <circle cx={pos.x} cy={pos.y} r={r + 10} fill={communityColor(n.community)} fill-opacity="0.10" />
              <circle cx={pos.x} cy={pos.y} r={r + 5}  fill={communityColor(n.community)} fill-opacity="0.20" />
              <!-- Node -->
              <circle cx={pos.x} cy={pos.y} r={r} fill={communityColor(n.community)} fill-opacity="1" />
            {/if}
          {/each}
        </g>

        <!-- Focus labels -->
        <g pointer-events="none">
          {#each activeStep.focusIds as id (id)}
            {@const n = nodeById.get(id)}
            {@const pos = nodePositions.get(id)}
            {#if n && pos}
              {@const r = rScale(n.sizeScore ?? n.connections)}
              <text
                x={pos.x + r + 6} y={pos.y + 4}
                class="node-label focus-label"
              >{n.displayName}</text>
            {/if}
          {/each}
        </g>

        <!-- Chain arrow overlay (Story 1 Step 5) -->
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

      </g>
      <!-- end data group -->

      <!-- ── Axis layer (same zoom, rendered on top) ───────────────────────────── -->
      <g transform={zoomStr}>
        <!-- Spine -->
        <line
          x1={spineX} x2={spineX}
          y1={PAD_TOP - 10} y2={CH - PAD_BOTTOM + 10}
          class="spine"
        />

        <!-- Decade ticks -->
        {#each decadeTicks as yr}
          {@const yy = yScale(yr)}
          <line x1={spineX - 36} x2={spineX} y1={yy} y2={yy} class="tick-line" />
          <text x={spineX - 44} y={yy + 4} text-anchor="end" class="tick-label">{yr}</text>
        {/each}

        <!-- Era endpoint labels -->
        <text x={spineX - 44} y={PAD_TOP - 18}        text-anchor="end" class="era-label">contemporary</text>
        <text x={spineX - 44} y={CH - PAD_BOTTOM + 30} text-anchor="end" class="era-label">roots</text>

        <!-- Era annotations -->
        {#each ERA_ANNOTATIONS as { year, label }}
          {@const yy = yScale(year)}
          <line x1={spineX - 22} x2={spineX} y1={yy} y2={yy} class="era-ann-tick" />
          <text x={spineX - 26} y={yy + 4} text-anchor="end" class="era-ann-label">{label}</text>
        {/each}
      </g>

    </svg>
  </div>

</div>

<style>
  .narrative-wrapper {
    position: relative;
    width: 100dvw;
    height: 100dvh;
    padding-top: 52px; /* clear the fixed header bar */
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
  }

  /* ── Story pane ────────────────────────────────────────────────────────────── */
  .story-pane {
    position: relative;
    width: 30%;
    flex-shrink: 0;
    height: 100%;
    overflow-y: scroll;
    background: #f5ede0;
    border-right: 1px solid #d4b888;
    scroll-behavior: smooth;
    /* hide scrollbar visually but keep functional */
    scrollbar-width: thin;
    scrollbar-color: #c8a870 #f5ede0;
  }

  /* Story tabs (sticky zone: story selector + step progress) */
  .story-tabs {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #f5ede0;
    border-bottom: 1px solid #d4b888;
    padding: 0.75rem 1.2rem 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .story-tab {
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.75rem;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .story-tab:hover { background: rgba(176, 104, 0, 0.07); }
  .story-tab.active {
    background: rgba(176, 104, 0, 0.12);
    border-color: #b06800;
  }

  .tab-title {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #7a5828;
    line-height: 1.2;
  }
  .story-tab:hover .tab-title  { color: #5a3808; }
  .story-tab.active .tab-title { color: #3a2008; }

  .tab-sub {
    font-size: 0.70rem;
    font-weight: 400;
    font-style: italic;
    letter-spacing: 0.01em;
    color: #7a5820;
    line-height: 1.3;
  }
  .story-tab.active .tab-sub { color: #7a5020; }

  /* Step progress dots (lives inside .story-tabs sticky zone) */
  .step-progress {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 0 0;
    border-top: 1px solid rgba(212, 184, 136, 0.45);
    margin-top: 0.15rem;
  }

  .step-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    border: 1.5px solid #b06800;
    background: transparent;
    padding: 0;
    cursor: pointer;
    pointer-events: all;
    transition: background 0.18s, transform 0.15s;
    flex-shrink: 0;
  }
  .step-dot:hover { background: rgba(176, 104, 0, 0.35); }
  .step-dot.active { background: #b06800; transform: scale(1.35); }

  .step-progress-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #7a5020;
    margin-left: 0.2rem;
  }

  /* Step cards */
  .step-card {
    min-height: 65vh;
    padding: 0 1.4rem;
    display: flex;
    align-items: center;
    border-left: 3px solid transparent;
    transition: border-color 0.3s;
  }
  .step-card.active {
    border-left-color: #b06800;
  }

  .step-inner {
    padding: 2rem 0;
  }

  .step-num {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a4e00;
    margin-bottom: 0.8rem;
  }

  .step-heading {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.2;
    color: #2a1408;
    margin-bottom: 1rem;
  }

  .step-callout {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1rem;
    font-style: italic;
    color: #7a3e00;
    border-left: 3px solid #8a4e00;
    padding-left: 0.75rem;
    margin: 0 0 1.2rem;
    line-height: 1.4;
  }

  /* Musician chips */
  .musician-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1.2rem;
  }

  .musician-chip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem 0.25rem 0.35rem;
    border-radius: 20px;
    border: 1px solid;
  }

  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chip-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    color: #2a1408;
    white-space: nowrap;
  }

  .chip-collabs {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    color: #7a5020;
    white-space: nowrap;
  }

  .step-body {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.84rem;
    line-height: 1.75;
    color: #4a3018;
  }

  /* End of story */
  .story-end {
    min-height: 50vh;
    padding: 3rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .story-end-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a6838;
    margin-bottom: 0.25rem;
  }

  .nav-btn {
    padding: 0.45rem 1rem;
    border-radius: 4px;
    border: 1px solid #b06800;
    background: transparent;
    color: #7a4a00;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .nav-btn:hover {
    background: rgba(176, 104, 0, 0.12);
    color: #3a2008;
  }
  .nav-btn-primary {
    background: rgba(176, 104, 0, 0.12);
    border-color: #8a4e00;
    color: #5a3000;
    font-size: 0.82rem;
  }
  .nav-btn-primary:hover {
    background: rgba(176, 104, 0, 0.22);
    color: #2a1008;
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
    gap: 0;
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

  /* ── Canvas pane ───────────────────────────────────────────────────────────── */
  .canvas-pane {
    position: relative;
    flex: 1;
    height: 100%;
    overflow: hidden;
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
