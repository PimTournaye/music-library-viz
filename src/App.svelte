<script>
  import { onMount } from 'svelte';
  import Graph from './lib/Graph.svelte';
  import Modal from './lib/Modal.svelte';
  import { communityColor } from './lib/colors.js';

  let graphData   = $state(null);
  let hoveredNode = $state(null);
  let modalOpen   = $state(false);

  onMount(async () => {
    graphData = await fetch('/graph.json').then(r => r.json());
  });

  // Community entries sorted by size (community 0 = largest)
  const communityEntries = $derived(
    graphData
      ? Object.entries(graphData.meta.communityLabel)
          .map(([id, name]) => ({ id: Number(id), name }))
          .slice(0, 10)
      : []
  );
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
    secondaryEdges={graphData.secondaryEdges}
    meta={graphData.meta}
    onhover={(n) => (hoveredNode = n)}
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

  <!-- ── Hovered node info ──────────────────────────────────────────────────── -->
  <div class="info" class:visible={!!hoveredNode}>
    {#if hoveredNode}
      <p class="info-name" style="color: {communityColor(hoveredNode.community)}">
        {hoveredNode.displayName}
      </p>
      <p class="info-stats">
        <span>{hoveredNode.degree} collaborators</span>
        <span class="sep">&middot;</span>
        <span>{hoveredNode.albumCount} albums</span>
      </p>
      {#if graphData.meta.communityLabel[hoveredNode.community]}
        <p class="info-community">
          {graphData.meta.communityLabel[hoveredNode.community]} circle
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
        <span class="legend-name">{name}</span>
      </div>
    {/each}
    {#if graphData.meta.communityCount > 10}
      <div class="legend-row legend-other">
        <span class="legend-pip" style="background:#2e2820"></span>
        <span class="legend-name">Other ({graphData.meta.communityCount - 10} groups)</span>
      </div>
    {/if}
  </nav>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body)  {
    overflow: hidden;
    background: #0a0907;
    background-image: radial-gradient(ellipse 90% 70% at 50% 44%, #1c1710 0%, #070604 100%);
  }
  :global(#app)  { width: 100dvw; height: 100dvh; }

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
    color: #c8b89a;
  }
  .subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.65rem; color: #3a3020;
    margin-top: 0.3rem; letter-spacing: 0.05em;
  }
  .about-btn {
    pointer-events: all;
    width: 22px; height: 22px; border-radius: 50%;
    border: 1px solid #2e2518;
    background: #18140f;
    color: #4a3f2f;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem; font-weight: 600;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.2s, color 0.2s;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .about-btn:hover { border-color: #f5c518; color: #f5c518; }

  /* Info panel */
  .info {
    position: fixed; bottom: 2rem; left: 2rem;
    pointer-events: none; user-select: none;
    opacity: 0; transform: translateY(4px);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  .info.visible { opacity: 1; transform: translateY(0); }

  .info-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.05rem; font-weight: 600;
    line-height: 1.2; transition: color 0.15s;
  }
  .info-stats {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.72rem; color: #5a4a2a;
    margin-top: 0.3rem; letter-spacing: 0.04em;
  }
  .sep { margin: 0 0.35em; }
  .info-community {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.65rem; color: #322a1a;
    margin-top: 0.15rem; font-style: italic;
  }

  /* Legend */
  .legend {
    position: fixed; top: 2rem; right: 2rem;
    display: flex; flex-direction: column; gap: 0;
    pointer-events: none; user-select: none;
    background: rgba(10, 9, 7, 0.55);
    border: 1px solid #1e1a12;
    border-radius: 4px;
    padding: 0.85rem 1rem;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .legend-heading {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #2e2518;
    margin-bottom: 0.6rem;
  }
  .legend-row {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.22rem 0;
  }
  .legend-pip {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .legend-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.67rem; color: #5a4a2a;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .legend-other .legend-name { color: #2e2518; }
</style>
