<script>
  let { open = $bindable(false) } = $props();

  function close() { open = false; }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={close}>
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <button class="close" onclick={close} aria-label="Close">×</button>

      <h1>Music Library<br/>Collaboration Network</h1>

      <p class="lead">
        A map of who played with whom across a personal jazz record collection.
        Each node is a musician; each edge means they shared at least one album.
      </p>

      <div class="rules">
        <div class="rule">
          <span class="rule-label">Node size</span>
          <span class="rule-desc">Number of distinct collaborators in the library</span>
        </div>
        <div class="rule">
          <span class="rule-label">Edge weight</span>
          <span class="rule-desc">
            Shared albums, tapered after two — first two albums count fully,
            then 1/3, 1/4… so long-running bands don't drown out one-off sessions
          </span>
        </div>
        <div class="rule">
          <span class="rule-label">Solid edges</span>
          <span class="rule-desc">Three or more shared albums</span>
        </div>
        <div class="rule">
          <span class="rule-label">Dashed edges</span>
          <span class="rule-desc">One or two shared albums — real but lighter connections</span>
        </div>
        <div class="rule">
          <span class="rule-label">Colour</span>
          <span class="rule-desc">Community — musicians who tend to cluster together</span>
        </div>
      </div>

      <div class="controls">
        <p class="controls-title">How to explore</p>
        <div class="control-grid">
          <span>Hover</span><span>Highlight connections</span>
          <span>Click</span><span>Pin a musician — move freely while locked</span>
          <span>Scroll</span><span>Zoom in and out</span>
          <span>Drag</span><span>Pan the canvas, or move individual nodes</span>
        </div>
      </div>

      <p class="footnote">
        Data sourced from Discogs performer credits. Includes performers only —
        engineers, producers, and arrangers are filtered out.
        Community detection by the Louvain algorithm.
      </p>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 4, 3, 0.75);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 2rem;
  }

  .modal {
    position: relative;
    background: #18140f;
    border: 1px solid #2e2518;
    border-radius: 4px;
    padding: 2.5rem;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }

  .close {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    color: #4a3f2f;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    transition: color 0.15s;
  }
  .close:hover { color: #c8b89a; }

  h1 {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 1.4rem;
    font-weight: 600;
    color: #e8d5a3;
    line-height: 1.25;
    margin-bottom: 1.1rem;
    letter-spacing: -0.01em;
  }

  .lead {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.85rem;
    color: #7a6840;
    line-height: 1.65;
    margin-bottom: 1.5rem;
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin-bottom: 1.5rem;
    padding: 1rem 1.1rem;
    background: #100e0a;
    border-radius: 3px;
    border: 1px solid #1e1a12;
  }

  .rule {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 0.75rem;
    align-items: baseline;
  }

  .rule-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    color: #f5c518;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .rule-desc {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.78rem;
    color: #5a4f37;
    line-height: 1.5;
  }

  .controls { margin-bottom: 1.5rem; }

  .controls-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    font-weight: 600;
    color: #4a3f2f;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 0.6rem;
  }

  .control-grid {
    display: grid;
    grid-template-columns: 4rem 1fr;
    gap: 0.3rem 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.78rem;
  }

  .control-grid span:nth-child(odd) {
    color: #c8b89a;
    font-weight: 500;
  }
  .control-grid span:nth-child(even) {
    color: #4a3f2f;
  }

  .footnote {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    color: #2e2518;
    line-height: 1.6;
    border-top: 1px solid #1a1510;
    padding-top: 1rem;
  }
</style>
