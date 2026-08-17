/**
 * Prism Path — canvas renderer with particles & smooth animation
 */
const Renderer = (() => {
  let canvas, ctx;
  let dpr = 1;
  let W = 0, H = 0;
  let cell = 0, pad = 0, boardOriginX = 0, boardOriginY = 0;
  let size = 5;

  // Visual state
  const particles = [];
  const floaters = [];
  let pulseT = 0;
  let shake = 0;
  let flash = 0;
  let bgPhase = 0;

  // Animating paths: colorId -> { cells, progress 0-1 }
  const pathAnims = new Map();

  function init(c) {
    canvas = c;
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const side = Math.max(120, Math.floor(Math.min(rect.width, rect.height)));
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = side * dpr;
    canvas.height = side * dpr;
    canvas.style.width = side + "px";
    canvas.style.height = side + "px";
    W = side;
    H = side;
    recomputeLayout();
  }

  function recomputeLayout() {
    if (!size) return;
    const margin = W * 0.06;
    const usable = W - margin * 2;
    cell = usable / size;
    pad = cell * 0.12;
    boardOriginX = margin;
    boardOriginY = margin;
  }

  function setSize(s) {
    size = s;
    recomputeLayout();
  }

  function cellCenter(r, c) {
    return {
      x: boardOriginX + c * cell + cell / 2,
      y: boardOriginY + r * cell + cell / 2,
    };
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    const c = Math.floor((x - boardOriginX) / cell);
    const r = Math.floor((y - boardOriginY) / cell);
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
    return { r, c, x, y };
  }

  function spawnParticles(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.5 + Math.random() * 0.5,
        max: 0.5 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color,
        g: 180,
      });
    }
  }

  function spawnBurst(r, c, color, n = 20) {
    const p = cellCenter(r, c);
    spawnParticles(p.x, p.y, color, n);
  }

  function spawnFloatText(text, r, c, color) {
    const p = cellCenter(r, c);
    floaters.push({
      text, x: p.x, y: p.y, life: 1, color: color || "#ffd166",
    });
  }

  function shakeBoard(amt = 6) { shake = amt; }
  function flashBoard(amt = 0.35) { flash = amt; }

  function setPathAnim(colorId, cells) {
    pathAnims.set(colorId, { cells: cells.slice(), progress: 0, done: false });
  }

  function clearPathAnim(colorId) {
    pathAnims.delete(colorId);
  }

  function update(dt) {
    pulseT += dt;
    bgPhase += dt * 0.3;
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.5);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.98;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt * 0.9;
      f.y -= 40 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }

    pathAnims.forEach((a) => {
      if (!a.done) {
        a.progress = Math.min(1, a.progress + dt * 2.2);
        if (a.progress >= 1) a.done = true;
      }
    });
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBackground() {
    // Deep panel
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#140a2e");
    g.addColorStop(0.5, "#0e0824");
    g.addColorStop(1, "#10082a");
    ctx.fillStyle = g;
    roundRect(0, 0, W, H, W * 0.04);
    ctx.fill();

    // Subtle animated vignette glow
    const vg = ctx.createRadialGradient(
      W * (0.5 + Math.sin(bgPhase) * 0.08),
      H * (0.45 + Math.cos(bgPhase * 0.7) * 0.06),
      0,
      W / 2, H / 2, W * 0.7
    );
    vg.addColorStop(0, "rgba(120, 80, 220, 0.12)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrid() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = boardOriginX + c * cell + pad;
        const y = boardOriginY + r * cell + pad;
        const s = cell - pad * 2;
        const radius = s * 0.22;

        // Cell base
        ctx.save();
        roundRect(x, y, s, s, radius);
        const cg = ctx.createLinearGradient(x, y, x, y + s);
        cg.addColorStop(0, "rgba(255,255,255,0.06)");
        cg.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = cg;
        ctx.fill();

        // Inner border
        ctx.strokeStyle = "rgba(160, 130, 255, 0.12)";
        ctx.lineWidth = Math.max(1, cell * 0.02);
        ctx.stroke();

        // Soft inset
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        roundRect(x + 1, y + 1, s - 2, s - 2, radius - 1);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function colorRgb(col) {
    if (Array.isArray(col)) return col;
    if (col && col.rgb) return col.rgb;
    return [200, 160, 255];
  }

  function rgba(rgb, a) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  }

  function drawPath(cells, rgb, widthScale, alpha, glow) {
    if (!cells || cells.length < 2) return;
    const pts = cells.map(({ r, c }) => cellCenter(r, c));
    const lw = cell * (widthScale || 0.28);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow pass
    if (glow !== false) {
      ctx.strokeStyle = rgba(rgb, 0.25 * alpha);
      ctx.lineWidth = lw * 2.2;
      ctx.shadowColor = rgba(rgb, 0.6 * alpha);
      ctx.shadowBlur = cell * 0.35;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }

    // Core path
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    grad.addColorStop(0, rgba(rgb, 0.95 * alpha));
    grad.addColorStop(0.5, rgba(
      [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 30), Math.min(255, rgb[2] + 40)],
      alpha
    ));
    grad.addColorStop(1, rgba(rgb, 0.95 * alpha));
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Highlight stroke
    ctx.strokeStyle = rgba([255, 255, 255], 0.25 * alpha);
    ctx.lineWidth = lw * 0.35;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    ctx.restore();
  }

  function drawPartialPath(cells, rgb, progress) {
    if (!cells || cells.length < 2 || progress <= 0) return;
    const total = cells.length - 1;
    const target = progress * total;
    const full = Math.floor(target);
    const frac = target - full;
    const pts = [];
    for (let i = 0; i <= full && i < cells.length; i++) {
      pts.push(cellCenter(cells[i].r, cells[i].c));
    }
    if (full < cells.length - 1) {
      const a = cellCenter(cells[full].r, cells[full].c);
      const b = cellCenter(cells[full + 1].r, cells[full + 1].c);
      pts.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac });
    }
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(rgb, 0.9);
    ctx.lineWidth = cell * 0.28;
    ctx.shadowColor = rgba(rgb, 0.7);
    ctx.shadowBlur = cell * 0.3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawOrb(r, c, rgb, opts = {}) {
    const { x, y } = cellCenter(r, c);
    const radius = cell * (opts.scale || 0.28);
    const pulse = 1 + Math.sin(pulseT * 3 + r + c) * 0.04;
    const R = radius * pulse * (opts.highlight ? 1.12 : 1);

    ctx.save();

    // Outer glow
    const glow = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 2.2);
    glow.addColorStop(0, rgba(rgb, 0.55));
    glow.addColorStop(0.4, rgba(rgb, 0.18));
    glow.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, R * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const body = ctx.createRadialGradient(
      x - R * 0.3, y - R * 0.35, R * 0.05,
      x, y, R
    );
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.25, rgba(
      [Math.min(255, rgb[0] + 60), Math.min(255, rgb[1] + 60), Math.min(255, rgb[2] + 60)],
      1
    ));
    body.addColorStop(0.7, rgba(rgb, 1));
    body.addColorStop(1, rgba(
      [Math.max(0, rgb[0] - 40), Math.max(0, rgb[1] - 40), Math.max(0, rgb[2] - 30)],
      1
    ));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();

    // Specular
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(x - R * 0.25, y - R * 0.3, R * 0.28, R * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Ring when complete
    if (opts.complete) {
      ctx.strokeStyle = rgba(rgb, 0.7 + Math.sin(pulseT * 4) * 0.2);
      ctx.lineWidth = Math.max(2, cell * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, R * 1.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hint pulse
    if (opts.hint) {
      const hr = R * (1.5 + Math.sin(pulseT * 6) * 0.2);
      ctx.strokeStyle = rgba(rgb, 0.5);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, hr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawHintPath(cells, rgb) {
    if (!cells || cells.length < 2) return;
    ctx.save();
    ctx.setLineDash([cell * 0.12, cell * 0.1]);
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba(rgb, 0.35 + Math.sin(pulseT * 5) * 0.15);
    ctx.lineWidth = cell * 0.1;
    const pts = cells.map(({ r, c }) => cellCenter(r, c));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color || "#ffffff";
      ctx.shadowColor = p.color || "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFloaters() {
    for (const f of floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = `bold ${Math.floor(cell * 0.35)}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  /**
   * state: {
   *   size, grid (endpoints),
   *   paths: Map colorId -> [{r,c},...],
   *   complete: Set colorId,
   *   draft: [{r,c},...] | null,
   *   draftColor: colorId | null,
   *   colorMap: id -> {rgb, hex},
   *   hint: { colorId, cells } | null,
   *   hover: {r,c} | null
   * }
   */
  function render(state) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground();
    drawGrid();

    // Hover highlight
    if (state.hover) {
      const { r, c } = state.hover;
      const x = boardOriginX + c * cell + pad;
      const y = boardOriginY + r * cell + pad;
      const s = cell - pad * 2;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(x, y, s, s, s * 0.22);
      ctx.fill();
    }

    // Completed / active paths
    if (state.paths) {
      state.paths.forEach((cells, colorId) => {
        const col = state.colorMap.get(colorId);
        const rgb = colorRgb(col);
        const anim = pathAnims.get(colorId);
        if (anim && !anim.done) {
          drawPartialPath(cells, rgb, anim.progress);
        } else {
          const done = state.complete && state.complete.has(colorId);
          drawPath(cells, rgb, done ? 0.3 : 0.28, done ? 1 : 0.9, true);
        }
      });
    }

    // Draft path being drawn
    if (state.draft && state.draft.length >= 1 && state.draftColor != null) {
      const col = state.colorMap.get(state.draftColor);
      const rgb = colorRgb(col);
      if (state.draft.length >= 2) {
        drawPath(state.draft, rgb, 0.26, 0.85, true);
      }
      // Cursor tip glow
      const last = state.draft[state.draft.length - 1];
      const p = cellCenter(last.r, last.c);
      ctx.save();
      ctx.fillStyle = rgba(rgb, 0.35);
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hint path under orbs
    if (state.hint) {
      const col = state.colorMap.get(state.hint.colorId);
      drawHintPath(state.hint.cells, colorRgb(col));
    }

    // Endpoint orbs
    if (state.grid) {
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          const id = state.grid[r][c];
          if (id < 0) continue;
          const col = state.colorMap.get(id);
          const rgb = colorRgb(col);
          const complete = state.complete && state.complete.has(id);
          const hint = state.hint && state.hint.colorId === id;
          const active = state.draftColor === id;
          drawOrb(r, c, rgb, { complete, hint, highlight: active || hint, scale: complete ? 0.3 : 0.28 });
        }
      }
    }

    drawParticles();
    drawFloaters();

    // Flash overlay
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.25})`;
      roundRect(0, 0, W, H, W * 0.04);
      ctx.fill();
    }

    ctx.restore();
  }

  return {
    init,
    resize,
    setSize,
    hitTest,
    update,
    render,
    spawnBurst,
    spawnParticles,
    spawnFloatText,
    shakeBoard,
    flashBoard,
    setPathAnim,
    clearPathAnim,
    cellCenter,
    get metrics() { return { W, H, cell, size }; },
  };
})();
