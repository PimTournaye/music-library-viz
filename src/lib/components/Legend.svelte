<script>
  import { yearGradientStops } from '../colors.js';

  const gradientStops = $derived(yearGradientStops());
</script>

<div class="legend">
  <!-- Node size -->
  <div class="legend-row">
    <div class="legend-icon" aria-hidden="true">
      <div class="size-circles">
        <div class="size-circle" style="width:16px; height:16px; opacity:0.5;"></div>
        <div class="size-circle" style="width:28px; height:28px; opacity:0.65;"></div>
        <div class="size-circle" style="width:42px; height:42px; opacity:0.8;"></div>
      </div>
    </div>
    <div class="legend-text-block">
      <span class="legend-label">Node size</span>
      <span class="legend-sub">Number of collaborators</span>
    </div>
  </div>

  <!-- Node colour -->
  <div class="legend-row">
    <div class="legend-icon" aria-hidden="true">
      <div class="color-circles">
        {#each gradientStops.filter((_, i) => i % 8 === 0) as stop}
          <div class="color-circle" style="background:{stop.color};"></div>
        {/each}
      </div>
    </div>
    <div class="legend-text-block">
      <span class="legend-label">Node colour</span>
      <span class="legend-sub">Median album year &mdash; <span style="color:#c9942a">older</span> to <span style="color:#4a7aaa">newer</span></span>
      <span class="legend-sub">The middle release year across all albums this musician appears on in my collection &mdash; not their full career, just what I own.</span>
    </div>
  </div>

  <!-- Edge weight -->
  <div class="legend-row">
    <div class="legend-icon" aria-hidden="true">
      <div class="edge-lines">
        <div class="edge-line" style="height:1px;  background:#a08060; opacity:0.7;"></div>
        <div class="edge-line" style="height:2px;  background:#c07010; opacity:0.8;"></div>
        <div class="edge-line" style="height:4px;  background:#aa4c00; opacity:0.9;"></div>
        <div class="edge-line" style="height:7px;  background:#521000; opacity:1.0;"></div>
      </div>
    </div>
    <div class="legend-text-block">
      <span class="legend-label">Edge weight</span>
      <span class="legend-sub">Albums shared &mdash; <span style="color:#a08060">fewer</span> to <span style="color:#521000">more</span></span>
    </div>
  </div>

  <!-- Edge interaction hint -->
  <div class="legend-row">
    <div class="legend-icon" aria-hidden="true">
      <div class="edge-interact">
        <div class="edge-interact-line"></div>
        <svg class="edge-interact-cursor" viewBox="0 0 18 20" width="14" height="16" fill="none">
          <path d="M2 2l12 8-5 1-2 5z" fill="#d4a860" stroke="#2a1408" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="legend-text-block">
      <span class="legend-label">Edge hover</span>
      <span class="legend-sub">Pin a node, then hover any connection to reveal shared albums</span>
    </div>
  </div>
</div>

<style>
  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding-top: 0.75rem;
    border-top: 2px solid #2a1408;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .legend-icon {
    flex-shrink: 0;
    width: 96px;
    display: flex;
    align-items: center;
  }

  /* Node size: three CSS circles aligned to bottom edge */
  .size-circles {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }
  .size-circle {
    border-radius: 50%;
    background: #7a6040;
    flex-shrink: 0;
  }

  /* Node colour: row of CSS circles */
  .color-circles {
    display: flex;
    align-items: center;
    vertical-align: middle;
    gap: 4px;
  }
  .color-circle {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Edge weight: stacked bars thin→thick, light→dark */
  .edge-lines {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    width: 100%;
  }
  .edge-line {
    width: 100%;
    border-radius: 2px;
  }

  /* Edge interaction hint */
  .edge-interact {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }
  .edge-interact-line {
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: #aa4c00;
    opacity: 0.9;
  }
  .edge-interact-cursor {
    position: absolute;
    left: 50%;
    top: -4px;
    transform: translateX(-30%);
    pointer-events: none;
  }

  /* Edge interaction hint */
  .edge-interact {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }
  .edge-interact-line {
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: #aa4c00;
    opacity: 0.9;
  }
  .edge-interact-cursor {
    position: absolute;
    left: 50%;
    top: -4px;
    transform: translateX(-30%);
    pointer-events: none;
  }

  .legend-text-block {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .legend-label {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.74rem;
    font-weight: 700;
    color: #2a1408;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .legend-sub {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.70rem;
    color: #7a5828;
    line-height: 1.3;
  }
</style>
