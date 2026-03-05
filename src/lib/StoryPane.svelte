<script>
  import { communityColor } from './colors.js';
  import { STORIES } from './stories.js';

  let {
    activeStory,
    activeStoryIdx,
    activeStepIdx,
    nodeById,
    onstepchange,
    onstorychange,
    onviewchange,
  } = $props();

  // ── Internal state ────────────────────────────────────────────────────────────
  let storySwitcherOpen = $state(false);
  let stepCardEls = $state([]);
  let storyPaneEl = $state(null);  // bound to step-cards-col (scrollable container)

  // ── Exported: scroll to a specific step card ──────────────────────────────────
  export function jumpToStep(idx) {
    const el = stepCardEls[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Reset scroll when story changes
  $effect(() => {
    void activeStoryIdx;
    if (storyPaneEl) storyPaneEl.scrollTop = 0;
  });

  // ── IntersectionObserver: scroll-driven step activation ───────────────────────
  $effect(() => {
    const cards = stepCardEls;
    if (!cards.length || !storyPaneEl) return;

    const obs = new IntersectionObserver(entries => {
      const intersecting = entries
        .filter(e => e.isIntersecting)
        .map(e => Number(e.target.dataset.stepIdx))
        .filter(idx => !isNaN(idx))
        .sort((a, b) => a - b);
      if (intersecting.length > 0) onstepchange(intersecting[0]);
    }, { threshold: 0.5, root: storyPaneEl });

    cards.forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="story-pane" role="region" aria-label="Story navigation">

  <!-- Story header (sticky) -->
  <div class="story-header">
    <div class="story-header-main">
      <p class="story-label">{activeStoryIdx + 1} / {STORIES.length}</p>
      <h1 class="story-current-title">{activeStory.title}</h1>
      <p class="story-current-sub">{activeStory.subtitle}</p>
    </div>
    <button
      class="story-switch-btn"
      onclick={() => storySwitcherOpen = !storySwitcherOpen}
      aria-label="Switch story"
    >
      {storySwitcherOpen ? '✕' : '☰'}
    </button>
    {#if storySwitcherOpen}
      <div class="story-list-overlay">
        {#each STORIES as s, i}
          <button
            class="story-list-item"
            class:active={i === activeStoryIdx}
            onclick={() => { onstorychange(i); storySwitcherOpen = false; }}
          >
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

    <!-- Scrollable step cards -->
    <div class="step-cards-col" bind:this={storyPaneEl}>

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
              <img
                class="step-cover"
                src={step.coverArt}
                alt="Featured album cover"
                loading="lazy"
                onerror={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            {/if}
            {#if step.callout}
              <p class="step-callout">{step.callout}</p>
            {/if}
            {#if step.focusIds.length <= 8}

              <!-- ── Option A: swatch + tabular ────────────────────────────── -->
              <div class="mc-a">
                <div class="mc-a-header">
                  <span class="mc-a-label">Personnel</span>
                  <span class="mc-a-col">connections</span>
                </div>
                <div class="mc-a-rule"></div>
                {#each step.focusIds as id}
                  {@const n = nodeById.get(id)}
                  {#if n}
                    {@const color = communityColor(n.community)}
                    <div class="mc-a-row">
                      <span class="mc-a-swatch" style="background:{color};"></span>
                      <span class="mc-a-name">{n.displayName}</span>
                      <span class="mc-a-count">{n.connections}</span>
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
          <button class="nav-btn nav-btn-primary" onclick={() => onstorychange(activeStoryIdx + 1)}>
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

    <!-- Vertical step rail -->
    <div class="step-rail-col">
      <div class="step-rail" role="group" aria-label="Story progress">
        {#each activeStory.steps as _, i}
          <button
            class="step-rail-dot"
            class:active={i === activeStepIdx}
            onclick={() => { onstepchange(i); jumpToStep(i); }}
            aria-label="Step {i + 1}"
          ></button>
        {/each}
      </div>
    </div>

  </div><!-- end story-body -->

</div>

<style>
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

  /* ── Story header ──────────────────────────────────────────────────────────── */
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
  .story-list-item:hover  { background: rgba(176, 104, 0, 0.07); }
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

  /* ── Step rail ─────────────────────────────────────────────────────────────── */
  .step-rail {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    padding: 0.5rem 0;
  }
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
  .step-rail-dot:hover { background: rgba(176, 104, 0, 0.2); }
  .step-rail-dot.active {
    background: #b06800;
    height: 26px;
    border-radius: 5px;
    box-shadow: 0 0 0 3px rgba(176, 104, 0, 0.2);
  }

  /* ── Step cards ────────────────────────────────────────────────────────────── */
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
  .step-card.active { border-left-color: #b06800; }

  .step-card-cluster {
    min-height: 75vh;
    scroll-snap-stop: normal;
  }

  .step-inner { padding: 2rem 0; }

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

  .step-cover {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 3px;
    margin-bottom: 1rem;
    display: block;
  }

  /* ── Option A: swatch + tabular ───────────────────────────────────────────── */
  .mc-a {
    margin-bottom: 1.4rem;
  }

  .mc-a-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.3rem;
  }

  .mc-a-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.60rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7a4e18;
  }

  .mc-a-col {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.60rem;
    letter-spacing: 0.06em;
    color: #9a7050;
  }

  .mc-a-rule {
    height: 1px;
    background: #c8a870;
    margin-bottom: 0.55rem;
    opacity: 0.6;
  }

  .mc-a-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.22rem 0;
  }

  .mc-a-swatch {
    width: 7px;
    height: 7px;
    border-radius: 1px;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .mc-a-name {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.76rem;
    font-weight: 600;
    color: #2a1408;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mc-a-count {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.68rem;
    color: #9a7050;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }


  .step-body {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.84rem;
    line-height: 1.75;
    color: #4a3018;
  }

  /* ── End of story ──────────────────────────────────────────────────────────── */
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
</style>
