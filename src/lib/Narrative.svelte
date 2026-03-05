<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { STORIES } from './stories.js';
  import StoryPane from './StoryPane.svelte';
  import NarrativeCanvas from './NarrativeCanvas.svelte';

  let { nodes, edges, meta, albumMeta = {}, onhover, onviewchange } = $props();

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function cleanName(n)  { return n.replace(/\s*\(\d+\)$/, ''); }
  function srcId(e) { return typeof e.source === 'object' ? e.source.id : e.source; }
  function tgtId(e) { return typeof e.target === 'object' ? e.target.id : e.target; }
  function seededRandom(seed) {
    let s = ((seed * 2654435761) >>> 0) || 1;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  }

  // ── Layout constants ──────────────────────────────────────────────────────────
  const YEAR_MIN      = 1954;
  const YEAR_MAX      = 2022;
  const PAD_TOP       = 116;   // 52px header + 64px breathing room
  const PAD_BOTTOM    = 80;
  const SPINE_X_RATIO = 0.30;
  const HEADER_H      = 52;

  // ── Resize state ──────────────────────────────────────────────────────────────
  let W = $state(window.innerWidth);
  let H = $state(window.innerHeight);
  function onResize() { W = window.innerWidth; H = window.innerHeight; }

  // ── Navigation state ──────────────────────────────────────────────────────────
  let activeStoryIdx = $state(0);
  let activeStepIdx  = $state(0);
  let ariaLiveText   = $state('');

  // Child component references (for exported function calls)
  let paneEl   = $state(null);   // StoryPane — exposes jumpToStep()
  let canvasEl = $state(null);   // NarrativeCanvas — exposes animateCamera()

  const activeStory = $derived(STORIES[activeStoryIdx]);
  const activeStep  = $derived(activeStory.steps[activeStepIdx]);

  // ── Canvas dimensions ─────────────────────────────────────────────────────────
  const CW     = $derived(W * 0.7);
  const CH     = $derived(H - HEADER_H);
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
      .domain([
        d3.min(nodes, n => n.sizeScore ?? n.connections) ?? 1,
        d3.max(nodes, n => n.sizeScore ?? n.connections) ?? 1,
      ])
      .range([3, 16]).clamp(true)
  );

  const yScale = $derived(
    d3.scaleLinear([YEAR_MIN, YEAR_MAX], [CH - PAD_BOTTOM, PAD_TOP])
  );

  // ── Force beeswarm (synchronous) ──────────────────────────────────────────────
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

  // ── Focus / context / edge sets for current step ──────────────────────────────
  const focusSet = $derived(new Set(activeStep.focusIds));

  const contextSet = $derived.by(() => {
    const ctx = new Set();
    for (const id of focusSet) {
      adjMap.get(id)?.forEach(nb => { if (!focusSet.has(nb)) ctx.add(nb); });
    }
    return ctx;
  });

  const visibleEdges = $derived(
    edges.filter(e => {
      const s = srcId(e), t = tgtId(e);
      if (!nodePositions.has(s) || !nodePositions.has(t)) return false;
      if (!focusSet.has(s) && !focusSet.has(t)) return false;
      return (focusSet.has(s) || contextSet.has(s)) && (focusSet.has(t) || contextSet.has(t));
    })
  );

  const chainIds = $derived(activeStep.chainIds ?? null);

  // ── Camera: delegate to NarrativeCanvas ──────────────────────────────────────
  $effect(() => {
    const step = activeStep;
    ariaLiveText = step.heading ?? '';
    const t = setTimeout(() => canvasEl?.animateCamera(step), 50);
    return () => clearTimeout(t);
  });

  // ── Navigation helpers ────────────────────────────────────────────────────────
  function switchStory(idx) {
    if (idx === activeStoryIdx) return;
    activeStoryIdx = idx;
    activeStepIdx  = 0;
  }

  function jumpToStep(idx) {
    activeStepIdx = idx;
    paneEl?.jumpToStep(idx);
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  onMount(() => {
    setTimeout(() => canvasEl?.animateCamera(activeStep), 100);

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
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<svelte:window onresize={onResize} />

<!-- Screen-reader live region -->
<div aria-live="polite" aria-atomic="true" class="sr-only">{ariaLiveText}</div>

<div class="narrative-wrapper">

  <StoryPane
    bind:this={paneEl}
    {activeStory}
    {activeStoryIdx}
    {activeStepIdx}
    {nodeById}
    onstepchange={(idx) => { activeStepIdx = idx; }}
    onstorychange={(idx) => switchStory(idx)}
    {onviewchange}
  />

  <NarrativeCanvas
    bind:this={canvasEl}
    {CW} {CH} {spineX}
    {PAD_TOP} {PAD_BOTTOM}
    {timedNodes} {nodePositions} {nodeById} {rScale}
    {focusSet} {contextSet} {visibleEdges}
    {activeStep} {chainIds}
    {yScale}
  />

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

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
    border: 0;
  }
</style>
