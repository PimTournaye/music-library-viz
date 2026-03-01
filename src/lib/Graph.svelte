<script>
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import * as PIXI from 'pixi.js';
  import { communityColor } from './colors.js';

  let { nodes, edges, meta, onhover } = $props();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function cleanName(name) { return name.replace(/\s*\(\d+\)$/, ''); }
  function hexNum(hex)      { return parseInt(hex.replace('#', ''), 16); }
  function nodeFillNum(n)   { return hexNum(communityColor(n.community)); }
  function nodeStrokeNum(n) {
    const c = d3.color(communityColor(n.community));
    return c ? hexNum(c.brighter(1.1).formatHex()) : 0xffffff;
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
  let hoveredId = $state(null);
  let pinnedId  = $state(null);

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
    const W = window.innerWidth;
    const H = window.innerHeight;

    const app = new PIXI.Application({
      view:            canvasEl,
      width:           W,
      height:          H,
      backgroundAlpha: 0,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
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
    const localMaxWeight = d3.max(simEdges, e => e.weight) ?? 1;
    const NUM_BUCKETS = 6;

    for (const e of simEdges) {
      const t = Math.max(e.weight - 1, 0) / Math.max(localMaxWeight - 1, 1);
      e.__b = Math.min(Math.floor(t * NUM_BUCKETS), NUM_BUCKETS - 1);
    }
    const edgeByBucket = Array.from({ length: NUM_BUCKETS }, () => []);
    for (const e of simEdges) edgeByBucket[e.__b].push(e);

    const bWidths = Array.from({ length: NUM_BUCKETS }, (_, b) =>
      0.5 + (b + 0.5) / NUM_BUCKETS * 2.5);
    const bAlphas = Array.from({ length: NUM_BUCKETS }, (_, b) =>
      0.06 + (b + 0.5) / NUM_BUCKETS * 0.49);

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
            pinnedId = null; hoveredId = null; onhover(null, 0, 0);
          } else {
            pinnedId = n.id;
            onhover(n, ge?.clientX ?? ev.data.global.x, ge?.clientY ?? ev.data.global.y);
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
        fill:            '#c8b89a',
        stroke:          '#0a0907',
        strokeThickness: 3.5,
        align:           'center',
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

    app.stage.on('pointermove', ev => {
      if (!draggingNode) return;
      draggingNode.__dragged = true;
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
        pinnedId = null; hoveredId = null; onhover(null, 0, 0);
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

    // ── Draw functions ────────────────────────────────────────────────────────
    function drawEdges() {
      edgeGfx.clear();
      const nb = neighbourhood;

      if (!nb) {
        for (let b = 0; b < NUM_BUCKETS; b++) {
          const bucket = edgeByBucket[b];
          if (!bucket.length) continue;
          edgeGfx.lineStyle(bWidths[b], 0xc8922a, bAlphas[b]);
          for (const e of bucket) {
            edgeGfx.moveTo(e.source.x, e.source.y);
            edgeGfx.lineTo(e.target.x, e.target.y);
          }
        }
      } else {
        edgeGfx.lineStyle(0.8, 0xc8922a, 0.008);
        for (const e of simEdges) {
          const sid = e.source.id ?? e.source;
          const tid = e.target.id ?? e.target;
          if (nb.has(sid) && nb.has(tid)) continue;
          edgeGfx.moveTo(e.source.x, e.source.y);
          edgeGfx.lineTo(e.target.x, e.target.y);
        }
        for (let b = 0; b < NUM_BUCKETS; b++) {
          let styleSet = false;
          for (const e of edgeByBucket[b]) {
            const sid = e.source.id ?? e.source;
            const tid = e.target.id ?? e.target;
            if (!nb.has(sid) || !nb.has(tid)) continue;
            if (!styleSet) {
              edgeGfx.lineStyle(bWidths[b] * 1.4, 0xf5c518, Math.min(bAlphas[b] * 4, 0.9));
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
      glowGfx.beginFill(0xf5c518, 0.22);
      glowGfx.drawCircle(n.x, n.y, r + 3);
      glowGfx.endFill();
      glowGfx.beginFill(0xf5c518, 0.10);
      glowGfx.drawCircle(n.x, n.y, r + 8);
      glowGfx.endFill();
      glowGfx.beginFill(0xf5c518, 0.04);
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
      });

    d3.select(canvasEl)
      .call(zoom)
      .call(zoom.transform, initialT);

    return () => {
      simulation?.stop();
      app.ticker.remove(() => {});
      drawEdgesFn   = null;
      updateNodesFn = null;
      updateGlowFn  = null;
      app.destroy(true, { children: true, texture: true });
    };
  });
</script>

<canvas bind:this={canvasEl} style="display:block; cursor:grab; width:100dvw; height:100dvh;"></canvas>
