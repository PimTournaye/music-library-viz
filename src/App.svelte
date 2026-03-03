<script>
  import { onMount } from 'svelte';
  import Graph from './lib/Graph.svelte';
  import ArcTimeline from './lib/ArcTimeline.svelte';
  import Narrative from './lib/Narrative.svelte';
  import { yearColor } from './lib/colors.js';
  import Sidebar from './lib/components/Sidebar.svelte';

  let graphData   = $state(null);
  let loadError   = $state(false);
  let hoveredNode = $state(null);
  let hoverX      = $state(0);
  let hoverY      = $state(0);
  let viewMode    = $state('graph'); // 'graph' | 'timeline' | 'story'

  async function loadData() {
    loadError = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch('/graph.json', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      graphData = await res.json();
    } catch {
      loadError = true;
    } finally {
      clearTimeout(timeout);
    }
  }

  onMount(loadData);

  // Live stats for tagline
  const nodeCount = $derived(graphData ? graphData.nodes.length : 0);
  const edgeCount = $derived(graphData ? graphData.edges.length : 0);

  // Sidebar width (matches CSS clamp)
  const SIDEBAR_W = 340;

  // Tooltip: clamp to viewport
  const tooltipLeft = $derived(Math.min(hoverX + 16, window.innerWidth  - 230));
  const tooltipTop  = $derived(Math.min(Math.max(hoverY - 48, 8), window.innerHeight - 110));
</script>

{#if loadError}
  <div class="loading" role="alert">
    <p class="load-error">Could not load data</p>
    <button class="retry-btn" onclick={loadData}>Retry</button>
  </div>
{:else if !graphData}
  <div class="loading" aria-label="Loading">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
  </div>
{:else}
  <Sidebar bind:viewMode {nodeCount} {edgeCount} />

  <main class="main-area">
  {#if viewMode === 'graph'}
    <Graph
      nodes={graphData.nodes}
      edges={graphData.edges}
      meta={graphData.meta}
      onhover={(n, x, y) => { hoveredNode = n; if (n) { hoverX = x; hoverY = y; } }}
    />
  {:else if viewMode === 'timeline'}
    <ArcTimeline
      nodes={graphData.nodes}
      edges={graphData.edges}
      meta={graphData.meta}
      onhover={(n, x, y) => { hoveredNode = n; if (n) { hoverX = x; hoverY = y; } }}
    />
  {:else}
    <Narrative
      nodes={graphData.nodes}
      edges={graphData.edges}
      meta={graphData.meta}
      onhover={(n, x, y) => { hoveredNode = n; if (n) { hoverX = x; hoverY = y; } }}
      onviewchange={(mode) => { viewMode = mode; }}
    />
  {/if}
  </main>

  <!-- ── Floating node tooltip ──────────────────────────────────────── -->
  {#if viewMode !== 'story'}
  <div
    class="tooltip"
    class:visible={!!hoveredNode}
    style="left: {tooltipLeft}px; top: {tooltipTop}px;"
  >
    {#if hoveredNode}
      <p class="tooltip-name" style="color: {yearColor(hoveredNode.medianYear)}">
        {hoveredNode.displayName}
      </p>
      <p class="tooltip-stats">
        {hoveredNode.connections} collabs &middot; {hoveredNode.albumCount} albums
      </p>
      {#if hoveredNode.medianYear}
        <p class="tooltip-community">
          median year {hoveredNode.medianYear}
        </p>
      {/if}
    {/if}
  </div>
  {/if}
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,700;1,700&family=Libre+Franklin:wght@400;600;700&display=swap');

  :global(body) { background: #eee4d2; }
  :global(#app) { width: 100dvw; height: 100dvh; }

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  .loading {
    position: fixed; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .dot {
    width: 5px; height: 5px; border-radius: 50%; background: #9a6828;
    animation: blink 1.2s ease-in-out infinite;
    display: inline-block;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100%{opacity:.1} 40%{opacity:1} }
  .load-error {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.85rem; color: #5a3a10;
    margin-bottom: 0.75rem;
  }
  .retry-btn {
    padding: 0.4rem 1rem; border-radius: 4px;
    border: 1px solid #9a7040; background: transparent; color: #5a3a10;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s;
  }
  .retry-btn:hover { background: rgba(154, 112, 64, 0.12); }

  /* ── Main content area (offset by sidebar) ─────────────────────────────── */
  .main-area {
    position: fixed;
    top: 0;
    left: clamp(340px, 25vw, 420px);
    right: 0;
    bottom: 0;
  }

  /* ── Floating tooltip ─────────────────────────────────────────────────────── */
  .tooltip {
    position: fixed;
    pointer-events: none; user-select: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    background: rgba(12, 9, 4, 0.92);
    border: 1px solid #3a2810;
    border-radius: 4px;
    padding: 0.6rem 0.85rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    min-width: 140px; max-width: 210px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    z-index: 60;
  }
  .tooltip.visible { opacity: 1; }

  .tooltip-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.92rem; font-weight: 600;
    line-height: 1.25; transition: color 0.15s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tooltip-stats {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.72rem; color: #b09060;
    margin-top: 0.2rem; letter-spacing: 0.02em;
  }
  .tooltip-community {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem; color: #8a7050;
    margin-top: 0.1rem; font-style: italic;
  }
</style>
