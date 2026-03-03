<script>
  let { viewMode = $bindable('graph') } = $props();
</script>

<nav class="panel-nav" aria-label="View mode">
  <button class="nav-tab" class:active={viewMode === 'graph'}    onclick={() => viewMode = 'graph'}>
    <!-- Network: two nodes connected by a line -->
    <svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="5"  cy="15" r="2.5" fill="currentColor" opacity="0.55"/>
      <circle cx="15" cy="5"  r="2.5" fill="currentColor" opacity="0.55"/>
      <circle cx="15" cy="15" r="2.5" fill="currentColor"/>
      <line x1="5" y1="15" x2="15" y2="5"  stroke="currentColor" stroke-width="1.25" stroke-opacity="0.5"/>
      <line x1="5" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1.25" stroke-opacity="0.5"/>
      <line x1="15" y1="5"  x2="15" y2="15" stroke="currentColor" stroke-width="1.25" stroke-opacity="0.5"/>
    </svg>
    <div class="nav-text">
      <span class="nav-label">Network</span>
      <span class="nav-desc">Force-directed graph of all connections</span>
    </div>
  </button>
  <button class="nav-tab" class:active={viewMode === 'timeline'} onclick={() => viewMode = 'timeline'}>
    <!-- Timeline: vertical axis with tick marks -->
    <svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="7" y1="5"  x2="14" y2="5"  stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      <line x1="7" y1="10" x2="17" y2="10" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      <line x1="7" y1="15" x2="12" y2="15" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    </svg>
    <div class="nav-text">
      <span class="nav-label">Timeline</span>
      <span class="nav-desc">Musicians arranged by active decade</span>
    </div>
  </button>
  <button class="nav-tab" class:active={viewMode === 'story'}    onclick={() => viewMode = 'story'}>
    <!-- Stories: open book -->
    <svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 16 C10 16 5 13.5 3 14V5C5 4.5 10 6.5 10 6.5V16Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/>
      <path d="M10 16 C10 16 15 13.5 17 14V5C15 4.5 10 6.5 10 6.5V16Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/>
    </svg>
    <div class="nav-text">
      <span class="nav-label">Stories</span>
      <span class="nav-desc">Curated paths through the collection</span>
    </div>
  </button>
</nav>

<style>
  .panel-nav {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-top: 1px solid rgba(192, 160, 112, 0.4);
    padding-top: 0.85rem;
  }
  .nav-tab {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.75rem;
    background: transparent;
    border: 1px solid rgba(192, 160, 112, 0.25);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .nav-tab::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(154, 104, 40, 0.06), rgba(154, 104, 40, 0.02));
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .nav-tab:hover {
    border-color: rgba(154, 104, 40, 0.45);
    transform: translateX(3px);
    box-shadow: 0 1px 6px rgba(42, 20, 8, 0.08);
  }
  .nav-tab:hover::before {
    opacity: 1;
  }
  .nav-tab:active {
    transform: translateX(3px) scale(0.985);
  }
  .nav-tab.active {
    background: rgba(154, 104, 40, 0.09);
    border-color: rgba(138, 78, 0, 0.5);
    box-shadow: 0 1px 8px rgba(42, 20, 8, 0.1);
  }
  .nav-tab.active:hover {
    transform: none;
  }

  /* Icon */
  .nav-icon {
    flex-shrink: 0;
    color: rgba(122, 88, 40, 0.55);
    transition: color 0.2s ease, transform 0.2s ease;
  }
  .nav-tab:hover .nav-icon {
    color: #5a3a18;
    transform: scale(1.1);
  }
  .nav-tab.active .nav-icon {
    color: #8a4e00;
  }

  .nav-text {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }
  .nav-label {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #5a3a18;
    transition: color 0.2s ease;
  }
  .nav-tab:hover .nav-label {
    color: #2a1408;
  }
  .nav-tab.active .nav-label {
    color: #8a4e00;
  }
  .nav-desc {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.67rem;
    color: #9a7848;
    line-height: 1.3;
    transition: color 0.2s ease;
  }
  .nav-tab:hover .nav-desc {
    color: #7a5828;
  }
  .nav-tab.active .nav-desc {
    color: #7a5828;
  }
</style>
