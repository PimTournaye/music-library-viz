<script>
  import { YEAR_MIN, YEAR_MAX } from '../colors.js';
  import Legend from './Legend.svelte';
  import ModeSwitcher from './ModeSwitcher.svelte';

  let { viewMode = $bindable('graph'), nodeCount = 0, edgeCount = 0 } = $props();
</script>

<aside class="sidebar">
  <div class="sidebar-scroll">
    <!-- Title + tagline -->
    <h1 class="sidebar-title">Collaborations across my music collection</h1>
    <p class="sidebar-tagline">{nodeCount} musicians &middot; {edgeCount} connections &middot; made in 2023</p>

    <!-- Legend -->
    <Legend />

    <!-- Description -->
    <div class="sidebar-desc">
      <p>A map of who played with whom across my music collection. Each dot is a musician; each line between two dots means they played together on at least one album. Data sourced from Discogs performer credits.</p>
      <p>I wanted to create this visualization to surface the unexpected lineages and hidden biggest collaborators lurking in my collection. It's a personal project, and I hope to update this every couple of years as I add more albums to the collection. Take this data with a grain of salt — there's some heavy filtering going on behind the scenes to weed out non-performers and reduce noise, resulting in some missing connections and collaborators.</p>
    </div>

    <!-- How to explore -->
    <div class="explore-section">
      <h2 class="explore-title">How to explore</h2>
      <ul class="explore-list">
        <li><strong>Hover</strong> a node to highlight its direct connections</li>
        <li><strong>Click</strong> to pin a node and keep its links visible</li>
        <li><strong>Hover an edge</strong> while a node is pinned to see shared albums</li>
        <li><strong>Scroll</strong> to zoom in and out</li>
        <li><strong>Drag</strong> to pan around the graph</li>
      </ul>
    </div>

    <!-- Mode switcher -->
    <ModeSwitcher bind:viewMode />
  </div>
</aside>

<style>
  .sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: clamp(340px, 25vw, 420px);
    background: rgba(238, 228, 210, 0.97);
    border-right: 1px solid #c0a070;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 50;
    overflow: hidden;
  }
  .sidebar-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 2rem 2rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sidebar-title {
    font-family: 'Bodoni Moda', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 700;
    font-style: italic;
    color: #2a1408;
    line-height: 1.15;
    margin: 0;
    letter-spacing: 0.01em;
  }
  .sidebar-tagline {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.76rem;
    color: #7a5828;
    margin: -0.4rem 0 0;
    letter-spacing: 0.02em;
  }

  .sidebar-desc {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(192, 160, 112, 0.4);
  }
  .sidebar-desc p {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.76rem;
    color: #5a3a18;
    line-height: 1.7;
    margin: 0;
  }

  .explore-section {
    padding-top: 0.75rem;
    border-top: 1px solid rgba(192, 160, 112, 0.4);
  }
  .explore-title {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #2a1408;
    margin: 0 0 0.4rem;
  }
  .explore-list {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.72rem;
    color: #5a3a18;
    line-height: 1.65;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .explore-list li { padding: 0; }
  .explore-list strong { color: #2a1408; font-weight: 700; }
</style>
