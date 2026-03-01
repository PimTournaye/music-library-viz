<script>
  import { onMount } from 'svelte';
  import Graph from './lib/Graph.svelte';
  import Modal from './lib/Modal.svelte';
  import { communityColor } from './lib/colors.js';

  let graphData   = $state(null);
  let hoveredNode = $state(null);
  let hoverX      = $state(0);
  let hoverY      = $state(0);
  let modalOpen   = $state(false);

  onMount(async () => {
    graphData = await fetch('/graph.json').then(r => r.json());
  });

  function sceneName(autoLabel) {
    return autoLabel.replace(/\s*\(\d+\)$/, '');
  }

  // Community entries sorted by size (community 0 = largest)
  const communityEntries = $derived(
    graphData
      ? Object.entries(graphData.meta.communityLabel)
          .map(([id, name]) => ({ id: Number(id), name }))
          .slice(0, 14)
      : []
  );

  // Member count per community, computed from nodes
  const communitySizes = $derived(
    graphData
      ? graphData.nodes.reduce((acc, n) => {
          acc[n.community] = (acc[n.community] || 0) + 1;
          return acc;
        }, {})
      : {}
  );

  // Tooltip position — clamp to viewport so it never clips off-screen
  const tooltipLeft = $derived(Math.min(hoverX + 20, window.innerWidth  - 230));
  const tooltipTop  = $derived(Math.min(Math.max(hoverY - 56, 12),       window.innerHeight - 110));
</script>

<Modal bind:open={modalOpen} />

{#if !graphData}
  <div class="loading" aria-label="Loading">
    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
  </div>

{:else}
  <Graph
    nodes={graphData.nodes}
    edges={graphData.edges}
    meta={graphData.meta}
    onhover={(n, x, y) => { hoveredNode = n; if (n) { hoverX = x; hoverY = y; } }}
  />

  <!-- ── Header ─────────────────────────────────────────────────────────────── -->
  <header class="header">
    <div>
      <p class="title">Collaboration Network</p>
      <p class="subtitle">
        {graphData.meta.nodeCount} musicians &middot; {graphData.meta.edgeCount} connections
      </p>
    </div>
    <button class="about-btn" onclick={() => (modalOpen = true)} aria-label="About this visualization">?</button>
  </header>

  <!-- ── Floating node tooltip ──────────────────────────────────────────────── -->
  <div
    class="tooltip"
    class:visible={!!hoveredNode}
    style="left: {tooltipLeft}px; top: {tooltipTop}px;"
  >
    {#if hoveredNode}
      <p class="tooltip-name" style="color: {communityColor(hoveredNode.community)}">
        {hoveredNode.displayName}
      </p>
      <p class="tooltip-stats">
        {hoveredNode.connections} collabs &middot; {hoveredNode.albumCount} albums
      </p>
      {#if graphData.meta.communityLabel[hoveredNode.community]}
        <p class="tooltip-community">
          {sceneName(graphData.meta.communityLabel[hoveredNode.community])}
        </p>
      {/if}
    {/if}
  </div>

  <!-- ── Legend ─────────────────────────────────────────────────────────────── -->
  <nav class="legend" aria-label="Communities">
    <p class="legend-heading">Communities</p>
    {#each communityEntries as { id, name }}
      <div class="legend-row">
        <span class="legend-pip" style="background: {communityColor(id)}; box-shadow: 0 0 5px {communityColor(id)}55"></span>
        <span class="legend-name">
          {sceneName(name)}
          <span class="legend-count">{communitySizes[id] ?? ''}</span>
        </span>
      </div>
    {/each}
    {#if graphData.meta.communityCount > 14}
      <div class="legend-row legend-other">
        <span class="legend-pip" style="background:#3a3028"></span>
        <span class="legend-name">Other ({graphData.meta.communityCount - 14} groups)</span>
      </div>
    {/if}
  </nav>
{/if}

<style>
  :global(#app) { width: 100dvw; height: 100dvh; }

  /* Loading */
  .loading {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .dot {
    width: 5px; height: 5px; border-radius: 50%; background: #f5c518;
    animation: blink 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100%{opacity:.1} 40%{opacity:1} }

  /* Header */
  .header {
    position: fixed; top: 2rem; left: 2rem;
    display: flex; align-items: flex-start; gap: 1.5rem;
    pointer-events: none;
  }
  .title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.8rem; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: #d4c090;
  }
  .subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.65rem; color: #8a7050;
    margin-top: 0.3rem; letter-spacing: 0.05em;
  }
  .about-btn {
    pointer-events: all;
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid #6a4f28;
    background: rgba(15, 10, 4, 0.8);
    color: #b09060;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem; font-weight: 600;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.2s, color 0.2s;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .about-btn:hover { border-color: #f5c518; color: #f5c518; }

  /* Floating tooltip */
  .tooltip {
    position: fixed;
    pointer-events: none; user-select: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    background: rgba(12, 9, 4, 0.9);
    border: 1px solid #3a2810;
    border-radius: 4px;
    padding: 0.6rem 0.85rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    min-width: 140px;
    max-width: 210px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .tooltip.visible { opacity: 1; }

  .tooltip-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.95rem; font-weight: 600;
    line-height: 1.25; transition: color 0.15s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tooltip-stats {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem; color: #b09060;
    margin-top: 0.25rem; letter-spacing: 0.03em;
  }
  .tooltip-community {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.63rem; color: #8a7050;
    margin-top: 0.1rem; font-style: italic;
  }

  /* Legend */
  .legend {
    position: fixed; top: 2rem; right: 2rem;
    display: flex; flex-direction: column; gap: 0;
    pointer-events: none; user-select: none;
    background: rgba(12, 9, 4, 0.82);
    border: 1px solid #3a2810;
    border-radius: 4px;
    padding: 0.9rem 1.1rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .legend-heading {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #7a6040;
    margin-bottom: 0.65rem;
  }
  .legend-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.28rem 0;
  }
  .legend-pip {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }
  .legend-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem; color: #c8a870;
    letter-spacing: 0.01em;
    white-space: nowrap;
    display: flex; align-items: baseline; gap: 0.4em;
  }
  .legend-count {
    font-size: 0.6rem; color: #7a6040; font-weight: 400;
  }
  .legend-other .legend-name { color: #7a6040; }
</style>
