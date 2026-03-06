<script>
  let { albumCount = 0 } = $props();
  let open = $state(false);
</script>

<div class="faq">
  <button class="faq-toggle" onclick={() => open = !open} aria-expanded={open}>
    <span>FAQ</span>
    <span class="faq-chevron" class:open></span>
  </button>

  {#if open}
    <div class="faq-body">

      <div class="faq-item">
        <p class="faq-q">Do you plan to update this beyond 2023?</p>
        <p class="faq-a">Yes I do, I hope to make this a yearly update.</p>
      </div>

      <div class="faq-item">
        <p class="faq-q">Do you only have jazz in your collection?</p>
        <p class="faq-a">No, but the vast majority is jazz and jazz-adjacent. I have some hip-hop, soul and funk, and a smattering of other genres, but yeah its probably around 92% jazz and improved music.</p>
      </div>

      <div class="faq-item">
        <p class="faq-q">What counts as a connection between two musicians?</p>
        <p class="faq-a">any recorded collaboration, whether thats a studio album, live performance, bootleg.</p>
      </div>

      <div class="faq-item">
        <p class="faq-q">Why is a musician missing from the graph?</p>
        <p class="faq-a">To keep the graph meaningful, a musician needs to appear on at least two albums in the collection under different primary artists. Credits for ensembles and large groups are filtered out too. Some musicians simply don't have enough connections within this specific collection to make the cut.</p>
      </div>

      {#if albumCount > 0}
        <div class="faq-item">
          <p class="faq-q">How many albums is this based on?</p>
          <p class="faq-a">The graph is built from {albumCount} albums. Every performer credit on every record feeds into the connection map — if two musicians appear together anywhere across those {albumCount} albums, they're connected.</p>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .faq {
    padding-top: 0.75rem;
    border-top: 1px solid rgba(192, 160, 112, 0.4);
  }

  .faq-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    padding: 0.35rem 0;
    cursor: pointer;
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #2a1408;
    text-decoration: underline;
    text-decoration-color: rgba(192, 160, 112, 0.5);
    text-underline-offset: 3px;
  }
  .faq-toggle:hover {
    color: #7a4a00;
    text-decoration-color: rgba(192, 160, 112, 0.9);
  }

  .faq-chevron {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-right: 2px solid #9a7050;
    border-bottom: 2px solid #9a7050;
    transform: rotate(-45deg);
    transition: transform 0.2s ease;
    flex-shrink: 0;
    margin-bottom: 2px;
  }
  .faq-chevron.open {
    transform: rotate(45deg);
    margin-bottom: 4px;
  }

  .faq-body {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-top: 0.75rem;
  }

  .faq-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .faq-q {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    color: #2a1408;
    margin: 0;
    line-height: 1.45;
  }

  .faq-a {
    font-family: 'Libre Franklin', system-ui, sans-serif;
    font-size: 0.72rem;
    color: #5a3a18;
    margin: 0;
    line-height: 1.7;
  }
</style>
