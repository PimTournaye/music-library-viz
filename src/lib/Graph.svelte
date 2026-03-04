<script>
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import * as PIXI from 'pixi.js';
  import { yearColor } from './colors.js';

  let { nodes, edges, meta, albumMeta = {}, onhover, onpin = () => {} } = $props();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function cleanName(name) { return name.replace(/\s*\(\d+\)$/, ''); }
  function colorToNum(colorStr) {
    const c = d3.color(colorStr);
    if (!c) return 0x6b5a42;
    return (c.r << 16) | (c.g << 8) | c.b;
  }
  function nodeFillNum(n)   { return colorToNum(yearColor(n.medianYear)); }
  function nodeStrokeNum(n) {
    const c = d3.color(yearColor(n.medianYear));
    if (!c) return 0x000000;
    const darker = c.darker(0.5);
    return (darker.r << 16) | (darker.g << 8) | darker.b;
  }

  // ── Adjacency ───────────────────────────────────────────────────────────────
  const adjMap = $derived.by(() => {
    const map = new Map();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source).add(e.target);
      map.get(e.target).add(e.source);
    }
    return map;
  });

  // ── Scales ──────────────────────────────────────────────────────────────────
  // Use actual min→max so the full visual range maps to real data spread.
  const minSize = $derived(d3.min(nodes, n => n.sizeScore ?? n.connections) ?? 1);
  const maxSize = $derived(d3.max(nodes, n => n.sizeScore ?? n.connections) ?? 1);
  const rScale  = $derived(d3.scaleSqrt().domain([minSize, maxSize]).range([4, 30]).clamp(true));

  const rankOf      = $derived(new Map(nodes.map((n, i) => [n.id, i])));
  const ALWAYS_LABEL = $derived(new Set(nodes.slice(0, 20).map(n => n.id)));

  // ── Simulation state (untracked snapshots — D3 mutates these) ───────────────
  const simNodes = untrack(() => nodes.map(n => ({ ...n, displayName: cleanName(n.name) })));
  const simEdges = untrack(() => edges.map(e => ({ ...e })));

  // ── Reactive interaction state ───────────────────────────────────────────────
  let hoveredId   = $state(null);
  let pinnedId    = $state(null);
  let hoveredEdge = $state(null); // { edge, clientX, clientY } — only set when a node is pinned

  const activeId = $derived(pinnedId ?? hoveredId);
  const neighbourhood = $derived.by(() => {
    if (activeId === null) return null;
    const s = new Set([activeId]);
    adjMap.get(activeId)?.forEach(id => s.add(id));
    return s;
  });

  // ── Canvas element ───────────────────────────────────────────────────────────
  let canvasEl;
  let simulation;

  let drawEdgesFn   = null;
  let updateNodesFn = null;
  let updateGlowFn  = null;
  let resetZoomFn   = null;
  let zoomInFn      = null;
  let zoomOutFn     = null;

  // ── Re-render when hover state changes (sim may be idle) ─────────────────────
  $effect(() => {
    neighbourhood;
    drawEdgesFn?.();
    updateNodesFn?.();
  });

  $effect(() => {
    activeId;
    updateGlowFn?.();
  });

  // ── Mount ───────────────────────────────────────────────────────────────────
  onMount(() => {
    const container = canvasEl.parentElement;
    const W = container.clientWidth;
    const H = container.clientHeight;

    const app = new PIXI.Application({
      view:            canvasEl,
      width:           W,
      height:          H,
      backgroundColor:  0xeee4d2,  // warm parchment
      backgroundAlpha:  1,
      antialias:        true,
      resolution:       window.devicePixelRatio || 1,
      autoDensity:      true,
    });

    const world = new PIXI.Container();
    app.stage.addChild(world);

    const initialT = d3.zoomIdentity.translate(W / 2, H / 2).scale(0.42);
    world.position.set(initialT.x, initialT.y);
    world.scale.set(initialT.k);

    // ── Layers ────────────────────────────────────────────────────────────────
    const edgeGfx   = new PIXI.Graphics();
    const glowGfx   = new PIXI.Graphics();
    const nodeLayer = new PIXI.Container();
    const lblLayer  = new PIXI.Container();
    world.addChild(edgeGfx, glowGfx, nodeLayer, lblLayer);

    // ── Edge style buckets ────────────────────────────────────────────────────
    // Use log scale: data is heavily right-skewed (73 % of edges have weight=1),
    // so linear bucketing collapses almost everything into bucket 0.
    const localMaxWeight = d3.max(simEdges, e => e.weight) ?? 1;
    const logMax = Math.log(Math.max(localMaxWeight, 2));
    const NUM_BUCKETS = 6;

    for (const e of simEdges) {
      const t = Math.log(Math.max(e.weight, 1)) / logMax;
      e.__b = Math.min(Math.floor(t * NUM_BUCKETS), NUM_BUCKETS - 1);
    }
    const edgeByBucket = Array.from({ length: NUM_BUCKETS }, () => []);
    for (const e of simEdges) edgeByBucket[e.__b].push(e);

    // Color ramp: near-background parchment-tan → deep maroon
    // Width + alpha also scale aggressively so strong edges really pop.
    const bColors  = [0xa08060, 0xcaa040, 0xc07010, 0xaa4c00, 0x832800, 0x521000];
    const bWidths  = [1.1,      1.3,      1.6,      2.8,      4.4,      6.5];
    const bAlphas  = [0.22,     0.30,     0.38,     0.62,     0.82,     0.95];

    // ── Node graphics ─────────────────────────────────────────────────────────
    const nodeGfxMap     = new Map();
    const nodeLblMap     = new Map();
    const nodeById       = new Map(simNodes.map(n => [n.id, n]));
    const nodeAlphaTarget = new Map(); // id → target alpha for smooth lerp
    let   draggingNode   = null;

    for (const n of simNodes) {
      const r  = rScale(n.sizeScore ?? n.connections);
      const fc = nodeFillNum(n);
      const sc = nodeStrokeNum(n);

      const gfx = new PIXI.Graphics();
      gfx.beginFill(fc);
      gfx.drawCircle(0, 0, r);
      gfx.endFill();
      gfx.lineStyle(1.2, sc, 0.5);
      gfx.drawCircle(0, 0, r);

      gfx.interactive = true;
      gfx.buttonMode  = true;
      gfx.hitArea     = new PIXI.Circle(0, 0, r + 4);

      gfx.on('pointerover', ev => {
        if (!pinnedId) {
          hoveredId = n.id;
          const ge = ev.data.originalEvent;
          onhover(n, ge?.clientX ?? ev.data.global.x, ge?.clientY ?? ev.data.global.y);
        }
      });
      gfx.on('pointerout', () => {
        if (!pinnedId) { hoveredId = null; onhover(null, 0, 0); }
      });
      gfx.on('pointerdown', ev => {
        ev.stopPropagation();
        draggingNode = n;
        n.__dragged  = false;
        n.__downX    = ev.data.global.x;
        n.__downY    = ev.data.global.y;
        simulation.alphaTarget(0.3).restart();
        n.fx = n.x; n.fy = n.y;
      });
      gfx.on('pointerup', ev => {
        if (draggingNode !== n) return;
        draggingNode = null;
        n.fx = null; n.fy = null;
        simulation.alphaTarget(0);
        if (!n.__dragged) {
          const ge = ev.data.originalEvent;
          if (pinnedId === n.id) {
            pinnedId = null; hoveredId = null; onhover(null, 0, 0); onpin(null, 0, 0);
          } else {
            pinnedId = n.id;
            const sx = ge?.clientX ?? ev.data.global.x;
            const sy = ge?.clientY ?? ev.data.global.y;
            onhover(n, sx, sy);
            onpin(n, sx, sy);
          }
        }
      });

      nodeAlphaTarget.set(n.id, 1);
      nodeGfxMap.set(n.id, gfx);
      nodeLayer.addChild(gfx);

      const rank     = rankOf.get(n.id) ?? 999;
      const fontSize = rank < 8 ? 12 : rank < 20 ? 10 : 9;
      const lbl = new PIXI.Text(n.displayName, {
        fontFamily:      'Inter, system-ui, sans-serif',
        fontSize,
        fill:            '#2a1808',
        stroke:          'rgba(238,228,210,0.88)',
        strokeThickness: 3.5,
        align:           'center',
        resolution:      window.devicePixelRatio * 2,
      });
      lbl.anchor.set(0.5, 0);
      lbl.alpha = 0;
      nodeLblMap.set(n.id, lbl);
      lblLayer.addChild(lbl);
    }

    // ── Smooth alpha lerp via PIXI ticker ─────────────────────────────────────
    // Runs every frame independently of D3 simulation, animating node fades.
    app.ticker.add(() => {
      for (const n of simNodes) {
        const gfx = nodeGfxMap.get(n.id);
        if (!gfx) continue;
        const target = nodeAlphaTarget.get(n.id) ?? 1;
        const diff   = target - gfx.alpha;
        if (Math.abs(diff) > 0.004) gfx.alpha += diff * 0.16;
        else gfx.alpha = target;
      }
    });

    // ── Stage pointer events ──────────────────────────────────────────────────
    app.stage.interactive = true;
    app.stage.hitArea     = new PIXI.Rectangle(0, 0, W, H);

    const DRAG_THRESHOLD = 5; // px — below this, treat as a click not a drag
    app.stage.on('pointermove', ev => {
      if (!draggingNode) return;
      if (!draggingNode.__dragged) {
        const dx = ev.data.global.x - (draggingNode.__downX ?? 0);
        const dy = ev.data.global.y - (draggingNode.__downY ?? 0);
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        draggingNode.__dragged = true;
      }
      const local = world.toLocal(ev.data.global);
      draggingNode.fx = local.x;
      draggingNode.fy = local.y;
    });
    app.stage.on('pointerup', () => {
      if (!draggingNode) return;
      draggingNode.fx = null; draggingNode.fy = null;
      simulation.alphaTarget(0);
      draggingNode = null;
    });
    app.stage.on('click', ev => {
      if (ev.target === app.stage) {
        pinnedId = null; hoveredId = null; onhover(null, 0, 0); onpin(null, 0, 0);
      }
    });

    // ── Drag vs pan: intercept before D3 zoom ─────────────────────────────────
    // D3 zoom attaches document-level listeners on pointerdown, before PIXI fires.
    // A capture-phase hit-test sets isDraggingNode so the zoom filter can block
    // pan gestures while a node is being dragged.
    let isDraggingNode = false;

    canvasEl.addEventListener('pointerdown', ev => {
      const rect = canvasEl.getBoundingClientRect();
      const wx   = (ev.clientX - rect.left - world.position.x) / world.scale.x;
      const wy   = (ev.clientY - rect.top  - world.position.y) / world.scale.y;
      isDraggingNode = simNodes.some(n => {
        if (n.x == null) return false;
        const dx = n.x - wx, dy = n.y - wy;
        const r  = rScale(n.sizeScore ?? n.connections) + 4;
        return dx * dx + dy * dy <= r * r;
      });
    }, { capture: true });

    canvasEl.addEventListener('pointerup',     () => { isDraggingNode = false; }, { capture: true });
    canvasEl.addEventListener('pointercancel', () => { isDraggingNode = false; }, { capture: true });

    // ── Edge hover hit-testing ──────────────────────────────────────────────
    function pointToSegmentDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(px - ax, py - ay);
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function onEdgeMouseMove(ev) {
      // Only active when a node is pinned and we're not dragging
      if (!pinnedId || draggingNode) {
        if (hoveredEdge !== null) hoveredEdge = null;
        return;
      }
      const rect   = canvasEl.getBoundingClientRect();
      const screenX = ev.clientX - rect.left;
      const screenY = ev.clientY - rect.top;
      const worldX  = (screenX - world.position.x) / world.scale.x;
      const worldY  = (screenY - world.position.y) / world.scale.y;
      // Hit threshold: ~8 px in screen space, converted to world units
      const threshold = 8 / world.scale.x;

      const nb = neighbourhood;
      let found = null;
      for (const e of simEdges) {
        if (e.source.x == null || e.target.x == null) continue;
        const sid = e.source.id ?? e.source;
        const tid = e.target.id ?? e.target;
        if (sid !== pinnedId && tid !== pinnedId) continue;
        const dist = pointToSegmentDist(worldX, worldY, e.source.x, e.source.y, e.target.x, e.target.y);
        if (dist < threshold) {
          found = { edge: e, clientX: ev.clientX, clientY: ev.clientY };
          break;
        }
      }
      hoveredEdge = found;
    }

    canvasEl.addEventListener('mousemove', onEdgeMouseMove);
    canvasEl.addEventListener('mouseleave', () => { hoveredEdge = null; });

    // ── Draw functions ────────────────────────────────────────────────────────
    function drawEdges() {
      edgeGfx.clear();
      const nb = neighbourhood;

      if (!nb) {
        for (let b = 0; b < NUM_BUCKETS; b++) {
          const bucket = edgeByBucket[b];
          if (!bucket.length) continue;
          edgeGfx.lineStyle(bWidths[b], bColors[b], bAlphas[b]);
          for (const e of bucket) {
            edgeGfx.moveTo(e.source.x, e.source.y);
            edgeGfx.lineTo(e.target.x, e.target.y);
          }
        }
      } else {
        // When a node is pinned, only highlight edges directly on that node.
        // When merely hovering, highlight all edges within the neighbourhood.
        const pid = pinnedId;
        const isHighlighted = pid
          ? (sid, tid) => sid === pid || tid === pid
          : (sid, tid) => nb.has(sid) && nb.has(tid);

        edgeGfx.lineStyle(0.5, 0xc8b898, 0.04);
        for (const e of simEdges) {
          const sid = e.source.id ?? e.source;
          const tid = e.target.id ?? e.target;
          if (isHighlighted(sid, tid)) continue;
          edgeGfx.moveTo(e.source.x, e.source.y);
          edgeGfx.lineTo(e.target.x, e.target.y);
        }
        for (let b = 0; b < NUM_BUCKETS; b++) {
          let styleSet = false;
          for (const e of edgeByBucket[b]) {
            const sid = e.source.id ?? e.source;
            const tid = e.target.id ?? e.target;
            if (!isHighlighted(sid, tid)) continue;
            if (!styleSet) {
              edgeGfx.lineStyle(bWidths[b] * 1.5, bColors[b], Math.min(bAlphas[b] * 1.1, 0.98));
              styleSet = true;
            }
            edgeGfx.moveTo(e.source.x, e.source.y);
            edgeGfx.lineTo(e.target.x, e.target.y);
          }
        }
      }
    }

    function updateNodes() {
      const nb = neighbourhood;
      for (const n of simNodes) {
        const gfx = nodeGfxMap.get(n.id);
        const lbl = nodeLblMap.get(n.id);
        if (!gfx) continue;

        gfx.x = n.x ?? 0;
        gfx.y = n.y ?? 0;

        // Set alpha target — PIXI ticker will lerp toward it smoothly
        nodeAlphaTarget.set(n.id, (!nb || nb.has(n.id)) ? 1 : 0.12);

        if (lbl) {
          lbl.x = gfx.x;
          lbl.y = gfx.y + rScale(n.sizeScore ?? n.connections) + 5;
          const show = nb ? nb.has(n.id) : ALWAYS_LABEL.has(n.id);
          lbl.alpha = show ? (nb ? 1 : 0.8) : 0;
        }
      }
    }

    function updateGlow() {
      glowGfx.clear();
      const aid = activeId;
      if (!aid) return;
      const n = nodeById.get(aid);
      if (!n || n.x == null) return;
      const r = rScale(n.sizeScore ?? n.connections);
      glowGfx.beginFill(0xb06800, 0.28);
      glowGfx.drawCircle(n.x, n.y, r + 3);
      glowGfx.endFill();
      glowGfx.beginFill(0xb06800, 0.12);
      glowGfx.drawCircle(n.x, n.y, r + 8);
      glowGfx.endFill();
      glowGfx.beginFill(0xb06800, 0.05);
      glowGfx.drawCircle(n.x, n.y, r + 16);
      glowGfx.endFill();
    }

    drawEdgesFn   = drawEdges;
    updateNodesFn = updateNodes;
    updateGlowFn  = updateGlow;

    // ── D3 force simulation ───────────────────────────────────────────────────
    simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges)
        .id(d => d.id)
        .distance(d => 90 + 140 / d.weight)
        .strength(0.18))
      .force('charge', d3.forceManyBody()
        .strength(d => -220 - d.connections * 14)
        .distanceMax(700))
      .force('center', d3.forceCenter(0, 0).strength(0.04))
      .force('collide', d3.forceCollide()
        .radius(d => rScale(d.sizeScore ?? d.connections) + 5)
        .strength(0.8))
      .alphaDecay(0.011)
      .on('tick', () => {
        drawEdges();
        updateNodes();
        if (activeId) updateGlow();
      });

    // ── D3 zoom → PixiJS world transform ─────────────────────────────────────
    let lastTextRes = window.devicePixelRatio * 2;

    const zoom = d3.zoom()
      .scaleExtent([0.05, 10])
      .filter(ev => {
        if (ev.type === 'wheel') return true;        // always allow scroll-zoom
        if (isDraggingNode) return false;            // block pan during node drag
        if (ev.type === 'dblclick') return false;
        return true;
      })
      .on('zoom', ev => {
        const t = ev.transform;
        world.position.set(t.x, t.y);
        world.scale.set(t.k);

        // Keep label textures crisp at any zoom level by re-rasterizing only
        // when the resolution tier changes (avoids per-frame GPU uploads).
        const targetRes = Math.min(
          Math.ceil(t.k * window.devicePixelRatio),
          Math.ceil(10 * window.devicePixelRatio),  // max = full scaleExtent
        );
        if (targetRes !== lastTextRes) {
          lastTextRes = targetRes;
          for (const lbl of nodeLblMap.values()) {
            lbl.resolution = targetRes;
          }
        }
      });

    d3.select(canvasEl)
      .call(zoom)
      .call(zoom.transform, initialT);

    // Expose zoom controls to Svelte template
    const zoomSel = d3.select(canvasEl);
    resetZoomFn = () => {
      zoomSel.transition().duration(600).ease(d3.easeQuadInOut)
        .call(zoom.transform, initialT);
    };
    zoomInFn = () => {
      zoomSel.transition().duration(250).ease(d3.easeQuadInOut)
        .call(zoom.scaleBy, 1.5);
    };
    zoomOutFn = () => {
      zoomSel.transition().duration(250).ease(d3.easeQuadInOut)
        .call(zoom.scaleBy, 1 / 1.5);
    };

    return () => {
      simulation?.stop();
      app.ticker.remove(() => {});
      resetZoomFn   = null;
      zoomInFn      = null;
      zoomOutFn     = null;
      drawEdgesFn   = null;
      updateNodesFn = null;
      updateGlowFn  = null;
      canvasEl.removeEventListener('mousemove', onEdgeMouseMove);
      canvasEl.removeEventListener('mouseleave', () => { hoveredEdge = null; });
      app.destroy(true, { children: true, texture: true });
    };
  });
</script>

<div style="position:relative; width:100%; height:100%;">
  <canvas bind:this={canvasEl} style="display:block; cursor:grab; width:100%; height:100%;"></canvas>

  <!-- ── Edge tooltip (shown when a node is pinned and cursor hovers an active edge) -->
  {#if hoveredEdge && pinnedId}
    {@const e  = hoveredEdge.edge}
    {@const nA = e.source.displayName ?? e.source.name ?? ''}
    {@const nB = e.target.displayName ?? e.target.name ?? ''}
    {@const albums = (e.albums ?? []).map(id => albumMeta[id]).filter(Boolean)}
    {@const shown  = albums.slice(0, 8)}
    {@const extra  = albums.length - 8}
    <div
      class="edge-tooltip"
      style="left: {Math.min(hoveredEdge.clientX + 18, window.innerWidth  - 260)}px;
             top:  {Math.min(Math.max(hoveredEdge.clientY - 20, 8), window.innerHeight - 320)}px;"
    >
      <p class="edge-tooltip-header">{nA} &times; {nB}</p>
      <ul class="edge-tooltip-list">
        {#each shown as a}
          <li>{a.artist} — {a.title}{a.year ? ` (${a.year})` : ''}</li>
        {/each}
        {#if extra > 0}
          <li class="edge-tooltip-more">+{extra} more</li>
        {/if}
      </ul>
    </div>
  {/if}

  <div class="zoom-controls" role="group" aria-label="Zoom controls">
    <button class="zoom-btn" onclick={() => zoomInFn?.()} aria-label="Zoom in" title="Zoom in">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="zoom-btn zoom-btn--reset" onclick={() => resetZoomFn?.()} aria-label="Reset zoom" title="Reset zoom">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1v2.5M7 13v-2.5M1 7h2.5M13 7h-2.5M3.2 3.2l1.77 1.77M9.03 9.03l1.77 1.77M10.8 3.2L9.03 4.97M4.97 9.03L3.2 10.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="zoom-btn" onclick={() => zoomOutFn?.()} aria-label="Zoom out" title="Zoom out">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .zoom-controls {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 1.5rem;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    border: 1px solid #9a7040;
    overflow: hidden;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .zoom-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 0;
    background: rgba(238, 228, 210, 0.88);
    color: #5a3a10;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .zoom-btn + .zoom-btn {
    border-top: 1px solid rgba(154, 112, 64, 0.4);
  }
  .zoom-btn--reset {
    background: rgba(228, 215, 192, 0.88);
  }
  .zoom-btn:hover {
    background: rgba(238, 228, 210, 1);
    color: #3a2008;
  }

  /* ── Edge tooltip ──────────────────────────────────────────────────────────── */
  .edge-tooltip {
    position: fixed;
    pointer-events: none;
    user-select: none;
    z-index: 65;
    background: rgba(12, 9, 4, 0.93);
    border: 1px solid #5a3820;
    border-radius: 5px;
    padding: 0.55rem 0.8rem 0.65rem;
    min-width: 160px;
    max-width: 250px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .edge-tooltip-header {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.78rem;
    font-weight: 600;
    color: #d4a860;
    margin: 0 0 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .edge-tooltip-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }
  .edge-tooltip-list li {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.70rem;
    color: #c8aa80;
    line-height: 1.35;
    white-space: normal;
    word-break: break-word;
  }
  .edge-tooltip-more {
    color: #8a7050 !important;
    font-style: italic;
    margin-top: 0.1rem;
  }
</style>
