<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { communityColor } from './colors.js';
  import { STORIES } from './stories.js';

  let { nodes, edges, meta, albumMeta = {}, onhover, onviewchange } = $props();

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
    { year: 1993, label: 'Young Lions' },
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
  let ariaLiveText   = $state('');

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

  // Watch activeStep → animate camera + update aria live text
  $effect(() => {
    const step = activeStep;
    ariaLiveText = step.heading ?? '';
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

  // ── Jump to a specific step (from progress dots / keyboard) ────────────────────
  function jumpToStep(idx) {
    activeStepIdx = idx;
    const el = stepCardEls[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let storyPaneEl = $state(null);
  let storySwitcherOpen = $state(false);

  // ── IntersectionObserver for scroll-driven step activation ───────────────────
  $effect(() => {
    const cards = stepCardEls;
    if (!cards.length) return;

    const obs = new IntersectionObserver(entries => {
      // Collect all currently intersecting cards and pick the first one
      const intersecting = entries
        .filter(e => e.isIntersecting)
        .map(e => Number(e.target.dataset.stepIdx))
        .filter(idx => !isNaN(idx))
        .sort((a, b) => a - b);
      
      if (intersecting.length > 0) {
        activeStepIdx = intersecting[0];
      }
    }, { threshold: 0.5, root: storyPaneEl });

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

    // ── Keyboard navigation ───────────────────────────────────────────────────
    function onKeyDown(e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = activeStepIdx + 1;
        if (next < activeStory.steps.length) {
          jumpToStep(next);
        } else if (activeStoryIdx < STORIES.length - 1) {
          switchStory(activeStoryIdx + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = activeStepIdx - 1;
        if (prev >= 0) jumpToStep(prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      if (svgEl) d3.select(svgEl).on('.zoom', null);
      window.removeEventListener('keydown', onKeyDown);
    };
  });
</script>

<svelte:window onresize={onResize} />

<!-- Screen-reader live region -->
<div aria-live="polite" aria-atomic="true" class="sr-only">{ariaLiveText}</div>

<div class="narrative-wrapper">

  <!-- ── Story pane (left 30%) ────────────────────────────────────────────────── -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="story-pane"
    role="region"
    aria-label="Story navigation"
  >

    <!-- Story header (sticky) -->
    <div class="story-header">
      <div class="story-header-main">
        <p class="story-label">{activeStoryIdx + 1} / {STORIES.length}</p>
        <h1 class="story-current-title">{activeStory.title}</h1>
        <p class="story-current-sub">{activeStory.subtitle}</p>
      </div>
      <button class="story-switch-btn" onclick={() => storySwitcherOpen = !storySwitcherOpen} aria-label="Switch story">
        {storySwitcherOpen ? '✕' : '☰'}
      </button>
      {#if storySwitcherOpen}
        <div class="story-list-overlay">
          {#each STORIES as s, i}
            <button class="story-list-item" class:active={i === activeStoryIdx}
              onclick={() => { switchStory(i); storySwitcherOpen = false; }}>
              <span class="sli-num">{String(i + 1).padStart(2, '0')}</span>
              <div class="sli-text">
                <span class="sli-title">{s.title}</span>
                <span class="sli-sub">{s.subtitle}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="story-body">
      <div class="step-cards-col" bind:this={storyPaneEl}>

    <!-- Step cards -->
    {#each activeStory.steps as step, i}
      <div
        class="step-card"
        class:active={i === activeStepIdx}
        class:step-card-cluster={activeStory.isClusters}
        data-step-idx={i}
        bind:this={stepCardEls[i]}
      >
        <div class="step-inner">
          {#if !activeStory.isClusters}
            <p class="step-num">{String(i + 1).padStart(2, '0')}</p>
          {/if}
          <h2 class="step-heading">{step.heading}</h2>
          {#if step.coverArt}
            <img class="step-cover" src={step.coverArt} alt="Featured album cover" loading="lazy"
              onerror={(e) => { e.currentTarget.style.display = 'none'; }} />
          {/if}
          {#if step.callout}
            <p class="step-callout">{step.callout}</p>
          {/if}
          {#if step.focusIds.length <= 8}
            <div class="musician-grid">
              {#each step.focusIds as id}
                {@const n = nodeById.get(id)}
                {#if n}
                  {@const color = communityColor(n.community)}
                  <div class="mc">
                    <span class="mc-bar" style="background:{color};"></span>
                    <span class="mc-name">{n.displayName}</span>
                    <span class="mc-stat">{n.connections}</span>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
          <p class="step-body">{@html step.body}</p>
        </div>
      </div>
    {/each}

    <!-- End-of-story navigation -->
    <div class="story-end">
      {#if activeStoryIdx < STORIES.length - 1 && !activeStory.isClusters}
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

      </div><!-- end step-cards-col -->

      <!-- Step rail column -->
      <div class="step-rail-col">
        <div class="step-rail" role="group" aria-label="Story progress">
          {#each activeStory.steps as _, i}
            <button
              class="step-rail-dot"
              class:active={i === activeStepIdx}
              onclick={() => jumpToStep(i)}
              aria-label="Step {i + 1}"
            ></button>
          {/each}
        </div>
      </div>

    </div><!-- end story-body -->

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
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f5ede0;
    border-right: 1px solid #d4b888;
  }

  .story-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .step-cards-col {
    flex: 1;
    overflow-y: scroll;
    scroll-behavior: smooth;
    scroll-snap-type: y mandatory;
    scroll-padding-top: 0;
    scrollbar-width: none;
  }
  .step-cards-col::-webkit-scrollbar { display: none; }

  .step-rail-col {
    width: 44px;
    flex-shrink: 0;
    background: #f5ede0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.5rem;
  }

  /* Story header */
  .story-header {
    position: relative;
    flex-shrink: 0;
    background: #f5ede0;
    border-bottom: 1px solid #d4b888;
    padding: 0.75rem 1.2rem 0.65rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .story-header-main {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .story-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a6038;
    margin: 0;
  }

  .story-current-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #2a1408;
    margin: 0;
    line-height: 1.2;
  }

  .story-current-sub {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    font-style: italic;
    color: #7a5020;
    margin: 0;
    line-height: 1.3;
  }

  .story-switch-btn {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 4px;
    border: 1px solid #c0a060;
    background: rgba(176, 104, 0, 0.05);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    color: #7a4a00;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .story-switch-btn:hover { background: rgba(176, 104, 0, 0.13); }

  .story-list-overlay {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 20;
    background: #f5ede0;
    border-bottom: 1px solid #d4b888;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
  }

  .story-list-item {
    width: 100%;
    text-align: left;
    padding: 0.65rem 1.2rem;
    border: none;
    border-bottom: 1px solid rgba(212, 184, 136, 0.3);
    background: transparent;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: background 0.13s;
  }
  .story-list-item:hover { background: rgba(176, 104, 0, 0.07); }
  .story-list-item.active { background: rgba(176, 104, 0, 0.12); }
  .story-list-item:last-child { border-bottom: none; }

  .sli-num {
    font-size: 0.70rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #9a7038;
    flex-shrink: 0;
  }

  .sli-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .sli-title {
    font-size: 0.80rem;
    font-weight: 600;
    color: #3a2008;
  }

  .sli-sub {
    font-size: 0.68rem;
    font-style: italic;
    color: #7a5020;
  }

  /* Vertical step rail column */
  .step-rail {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    padding: 0.5rem 0;
  }
  /* connecting track line */
  .step-rail::before {
    content: '';
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: 1.5px;
    background: rgba(176, 104, 0, 0.2);
    border-radius: 1px;
    z-index: 0;
  }

  .step-rail-dot {
    position: relative;
    z-index: 1;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #b06800;
    background: #f5ede0;
    padding: 0;
    cursor: pointer;
    pointer-events: all;
    transition: background 0.18s, height 0.18s, border-radius 0.18s, box-shadow 0.18s;
    flex-shrink: 0;
  }
  .step-rail-dot:hover {
    background: rgba(176, 104, 0, 0.2);
  }
  .step-rail-dot.active {
    background: #b06800;
    height: 26px;
    border-radius: 5px;
    box-shadow: 0 0 0 3px rgba(176, 104, 0, 0.2);
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
    border: 0;
  }

  /* Step cards */
  .step-card {
    min-height: 65vh;
    padding: 0 1.4rem;
    display: flex;
    align-items: center;
    border-left: 3px solid transparent;
    transition: border-color 0.3s;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
  .step-card.active {
    border-left-color: #b06800;
  }
  /* Compact cards for cluster snapshots */
  .step-card-cluster {
    min-height: 75vh;
    scroll-snap-stop: normal;
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

  /* Featured album cover */
  .step-cover {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 3px;
    margin-bottom: 1rem;
    display: block;
  }

  /* Compact musician grid */
  .musician-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem 0.5rem;
    margin-bottom: 1.2rem;
  }

  .mc {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.15rem 0;
  }

  .mc-bar {
    width: 3px;
    height: 1.1rem;
    border-radius: 2px;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .mc-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: #2a1408;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .mc-stat {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    color: #8a6030;
    flex-shrink: 0;
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
