<script>
  import { onMount } from 'svelte';
  import Graph from './lib/Graph.svelte';
  import { communityColor, COMMUNITY_COLORS } from './lib/colors.js';

  let graphData  = $state(null);
  let hoveredNode = $state(null);

  onMount(async () => {
    graphData = await fetch('/graph.json').then(r => r.json());
  });
</script>

{#if !graphData}
  <div class="loading" aria-label="Loading graph">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>

{:else}
  <Graph
    nodes={graphData.nodes}
    edges={graphData.edges}
    onhover={(n) => (hoveredNode = n)}
  />

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <header class="header">
    <p class="title">Collaboration Network</p>
    <p class="subtitle">
      {graphData.meta.nodeCount} musicians &middot; {graphData.meta.edgeCount} connections
    </p>
  </header>

  <!-- ── Hovered node info ───────────────────────────────────────────────── -->
  <div class="info" class:visible={!!hoveredNode}>
    {#if hoveredNode}
      <p class="info-name"
         style="color: {communityColor(hoveredNode.community)}">
        {hoveredNode.name}
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

  <!-- ── Community legend ────────────────────────────────────────────────── -->
  <nav class="legend">
    {#each Object.entries(graphData.meta.communityLabel).slice(0, 10) as [id, name]}
      <div class="legend-row">
        <span class="legend-pip" style="background:{communityColor(Number(id))}"></span>
        <span class="legend-name">{name}</span>
      </div>
    {/each}
    {#if graphData.meta.communityCount > 10}
      <div class="legend-row">
        <span class="legend-pip" style="background:#3a3830"></span>
        <span class="legend-name">Other</span>
      </div>
    {/if}
  </nav>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body)  { background: #080808; overflow: hidden; color: #e8d5a3; }
  :global(#app)  { width: 100dvw; height: 100dvh; }

  /* ── Loading ── */
  .loading {
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #f5c518;
    animation: blink 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100%{opacity:.12} 40%{opacity:1} }

  /* ── Header ── */
  .header {
    position: fixed; top: 2rem; left: 2rem;
    pointer-events: none; user-select: none;
  }
  .title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.9rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #e8d5a3;
  }
  .subtitle {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    color: #4a4030;
    margin-top: 0.3rem;
    letter-spacing: 0.06em;
  }

  /* ── Info panel ── */
  .info {
    position: fixed; bottom: 2rem; left: 2rem;
    pointer-events: none; user-select: none;
    opacity: 0; transform: translateY(5px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .info.visible { opacity: 1; transform: translateY(0); }

  .info-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.1rem; font-weight: 600;
    line-height: 1.2;
    transition: color 0.15s;
  }
  .info-stats {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem; color: #6a5a3a;
    margin-top: 0.3rem; letter-spacing: 0.04em;
  }
  .sep { margin: 0 0.35em; }
  .info-community {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.67rem; color: #3a3020;
    margin-top: 0.15rem;
    font-style: italic; letter-spacing: 0.05em;
  }

  /* ── Legend ── */
  .legend {
    position: fixed; top: 2rem; right: 2rem;
    display: flex; flex-direction: column; gap: 0.4rem;
    pointer-events: none; user-select: none;
  }
  .legend-row {
    display: flex; align-items: center; gap: 0.5rem;
  }
  .legend-pip {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .legend-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.65rem; color: #5a4a2a;
    letter-spacing: 0.04em;
  }
</style>
