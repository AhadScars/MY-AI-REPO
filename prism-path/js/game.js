/**
 * Prism Path — main game controller
 * Connect matching crystals without crossing paths.
 */
(() => {
  "use strict";

  // ── DOM ──
  const $ = (s) => document.querySelector(s);
  const screens = {
    title: $("#screen-title"),
    how: $("#screen-how"),
    game: $("#screen-game"),
  };
  const overlayWin = $("#overlay-win");
  const overlayMenu = $("#overlay-menu");
  const canvas = $("#game-canvas");
  const levelNumEl = $("#level-num");
  const progressFill = $("#progress-fill");
  const timerEl = $("#timer");
  const comboBanner = $("#combo-banner");
  const boardGlow = $("#board-glow");

  // ── Persistence ──
  function loadStats() {
    try {
      return {
        bestLevel: parseInt(localStorage.getItem("prism_best") || "1", 10),
        totalWins: parseInt(localStorage.getItem("prism_wins") || "0", 10),
        currentLevel: parseInt(localStorage.getItem("prism_level") || "1", 10),
      };
    } catch {
      return { bestLevel: 1, totalWins: 0, currentLevel: 1 };
    }
  }
  function saveStats(s) {
    try {
      localStorage.setItem("prism_best", String(s.bestLevel));
      localStorage.setItem("prism_wins", String(s.totalWins));
      localStorage.setItem("prism_level", String(s.currentLevel));
    } catch (_) {}
  }
  let stats = loadStats();

  function refreshTitleStats() {
    $("#best-level").textContent = String(stats.bestLevel);
    $("#total-wins").textContent = String(stats.totalWins);
  }
  refreshTitleStats();
  updateMuteButtons();

  // ── Screen helpers ──
  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle("active", k === name);
    });
  }

  function updateMuteButtons() {
    const icon = AudioSys.isMuted() ? "🔇" : "🔊";
    const label = AudioSys.isMuted() ? "🔇 Muted" : "🔊 Sound";
    const m = $("#btn-mute");
    const t = $("#btn-mute-title");
    if (m) m.textContent = icon;
    if (t) t.textContent = label;
  }

  // ── Game state ──
  let level = stats.currentLevel || 1;
  let levelData = null;
  let paths = new Map();       // colorId -> [{r,c}, ...]
  let complete = new Set();    // colorId
  let occupancy = new Map();   // "r,c" -> colorId (path cells, not necessarily endpoints)
  let draft = null;            // [{r,c}, ...]
  let draftColor = null;
  let drawing = false;
  let moves = 0;
  let hintsUsed = 0;
  let hint = null;
  let hintTimer = 0;
  let hover = null;
  let elapsed = 0;
  let running = false;
  let won = false;
  let pathHistory = [];        // stack of { colorId, cells } for undo
  let lastTs = 0;
  let comboCount = 0;

  const colorMap = new Map();

  function cellKey(r, c) { return r + "," + c; }

  function rebuildOccupancy() {
    occupancy.clear();
    paths.forEach((cells, colorId) => {
      cells.forEach(({ r, c }) => {
        // Endpoints stay "owned" by their color even when path empty
        occupancy.set(cellKey(r, c), colorId);
      });
    });
    // Always mark endpoints
    if (levelData) {
      levelData.endpoints.forEach((ep) => {
        occupancy.set(cellKey(ep.a.r, ep.a.c), ep.colorId);
        occupancy.set(cellKey(ep.b.r, ep.b.c), ep.colorId);
      });
    }
  }

  function isEndpoint(r, c) {
    if (!levelData) return false;
    return levelData.grid[r][c] >= 0;
  }

  function endpointColor(r, c) {
    return levelData ? levelData.grid[r][c] : -1;
  }

  function clearPath(colorId, recordUndo = true) {
    if (!paths.has(colorId)) return;
    if (recordUndo) {
      pathHistory.push({ colorId, cells: paths.get(colorId).map((p) => ({ ...p })) });
    }
    paths.delete(colorId);
    complete.delete(colorId);
    Renderer.clearPathAnim(colorId);
    rebuildOccupancy();
  }

  function startLevel(lvl, newSeed) {
    level = Math.max(1, lvl | 0);
    levelData = LevelGen.generate(level, newSeed);
    paths = new Map();
    complete = new Set();
    draft = null;
    draftColor = null;
    drawing = false;
    moves = 0;
    hintsUsed = 0;
    hint = null;
    hintTimer = 0;
    hover = null;
    elapsed = 0;
    running = true;
    won = false;
    pathHistory = [];
    comboCount = 0;
    boardGlow.classList.remove("win");
    overlayWin.classList.remove("show");
    overlayMenu.classList.remove("show");

    colorMap.clear();
    levelData.colors.forEach((c) => colorMap.set(c.id, c));
    // Also ensure all palette colors used in grid are mapped
    LevelGen.PALETTE.forEach((c) => {
      if (!colorMap.has(c.id)) colorMap.set(c.id, c);
    });

    Renderer.setSize(levelData.size);
    rebuildOccupancy();

    levelNumEl.textContent = String(level);
    progressFill.style.width = "0%";
    timerEl.textContent = "0:00";
    updateProgress();
  }

  function updateProgress() {
    const total = levelData ? levelData.pairCount : 1;
    const done = complete.size;
    const pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
  }

  function formatTime(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function canEnter(r, c, colorId) {
    const k = cellKey(r, c);
    const owner = occupancy.get(k);
    if (owner == null) return true;
    // Can enter own path cells (for backtracking) or own endpoints
    if (owner === colorId) return true;
    // Can enter matching endpoint of same color
    if (isEndpoint(r, c) && endpointColor(r, c) === colorId) return true;
    return false;
  }

  function onPointerDown(e) {
    if (!running || won) return;
    e.preventDefault();
    AudioSys.unlock();
    const pt = e.touches ? e.touches[0] : e;
    const hit = Renderer.hitTest(pt.clientX, pt.clientY);
    if (!hit) return;

    const { r, c } = hit;
    const ep = endpointColor(r, c);

    // Start from an endpoint
    if (ep >= 0) {
      // Clear existing path for this color
      if (paths.has(ep)) {
        clearPath(ep, true);
        AudioSys.play("erase");
      }
      drawing = true;
      draftColor = ep;
      draft = [{ r, c }];
      AudioSys.play("tap", { pitch: ep * 30 });
      return;
    }

    // Start from existing path cell — truncate to that point and continue
    const owner = occupancy.get(cellKey(r, c));
    if (owner != null && paths.has(owner)) {
      const cells = paths.get(owner);
      const idx = cells.findIndex((p) => p.r === r && p.c === c);
      if (idx >= 0) {
        pathHistory.push({ colorId: owner, cells: cells.map((p) => ({ ...p })) });
        const truncated = cells.slice(0, idx + 1);
        paths.delete(owner);
        complete.delete(owner);
        rebuildOccupancy();
        drawing = true;
        draftColor = owner;
        draft = truncated;
        // re-add draft occupancy temporarily not needed
        AudioSys.play("tap", { pitch: owner * 30 });
      }
    }
  }

  function onPointerMove(e) {
    const pt = e.touches ? e.touches[0] : e;
    const hit = Renderer.hitTest(pt.clientX, pt.clientY);
    hover = hit ? { r: hit.r, c: hit.c } : null;

    if (!drawing || !draft || draftColor == null || won) return;
    e.preventDefault();
    if (!hit) return;

    const { r, c } = hit;
    const last = draft[draft.length - 1];
    if (last.r === r && last.c === c) return;

    // Backtrack if revisiting earlier cell
    const backIdx = draft.findIndex((p) => p.r === r && p.c === c);
    if (backIdx >= 0) {
      draft = draft.slice(0, backIdx + 1);
      AudioSys.play("draw", { pitch: -1 });
      return;
    }

    // Must step to adjacent free cell
    if (!isAdjacent(last, { r, c })) {
      // Allow multi-step if path is free (optional smooth draw) — skip for precision
      return;
    }

    if (!canEnter(r, c, draftColor)) {
      // Hit foreign path
      Renderer.shakeBoard(4);
      AudioSys.play("error");
      return;
    }

    // If entering another endpoint of different color, block
    if (isEndpoint(r, c) && endpointColor(r, c) !== draftColor) {
      Renderer.shakeBoard(4);
      AudioSys.play("error");
      return;
    }

    draft.push({ r, c });
    AudioSys.play("draw", { pitch: draft.length * 0.3 });

    // Auto-complete when reaching matching endpoint
    if (isEndpoint(r, c) && endpointColor(r, c) === draftColor && draft.length > 1) {
      finishDraft(true);
    }
  }

  function onPointerUp(e) {
    if (!drawing) return;
    e.preventDefault();
    finishDraft(false);
  }

  function finishDraft(forcedComplete) {
    if (!draft || draftColor == null) {
      drawing = false;
      draft = null;
      draftColor = null;
      return;
    }

    const colorId = draftColor;
    const cells = draft.map((p) => ({ ...p }));
    const start = cells[0];
    const end = cells[cells.length - 1];

    // Valid connection: both ends are matching endpoints, length >= 2
    const startEp = endpointColor(start.r, start.c) === colorId;
    const endEp = endpointColor(end.r, end.c) === colorId;
    const connected = startEp && endEp && cells.length >= 2 &&
      !(start.r === end.r && start.c === end.c);

    drawing = false;

    if (connected || forcedComplete) {
      // Verify no cell conflict with other paths
      let conflict = false;
      for (let i = 0; i < cells.length; i++) {
        const { r, c } = cells[i];
        const k = cellKey(r, c);
        // Check against other completed paths
        for (const [oid, ocells] of paths) {
          if (oid === colorId) continue;
          if (ocells.some((p) => p.r === r && p.c === c)) {
            conflict = true;
            break;
          }
        }
        if (conflict) break;
        // Foreign endpoint
        if (isEndpoint(r, c) && endpointColor(r, c) !== colorId) {
          conflict = true;
          break;
        }
      }

      if (conflict || !connected) {
        draft = null;
        draftColor = null;
        AudioSys.play("error");
        Renderer.shakeBoard(5);
        return;
      }

      pathHistory.push({ colorId, cells: null }); // null = was empty before this path
      paths.set(colorId, cells);
      complete.add(colorId);
      rebuildOccupancy();
      moves++;
      comboCount++;
      Renderer.setPathAnim(colorId, cells);

      const col = colorMap.get(colorId);
      const last = cells[cells.length - 1];
      const hex = col ? col.hex : "#ffffff";
      Renderer.spawnBurst(last.r, last.c, hex, 18);
      Renderer.spawnBurst(cells[0].r, cells[0].c, hex, 12);
      Renderer.spawnFloatText("LINK", last.r, last.c, hex);
      AudioSys.play("connect");

      if (comboCount >= 2) {
        showCombo(comboCount);
      }

      updateProgress();
      checkWin();
    } else if (cells.length >= 2) {
      // Partial path — keep it for visual continuity but not complete
      pathHistory.push({ colorId, cells: null });
      paths.set(colorId, cells);
      complete.delete(colorId);
      rebuildOccupancy();
      moves++;
      comboCount = 0;
      AudioSys.play("tap");
    }

    draft = null;
    draftColor = null;
  }

  function showCombo(n) {
    const phrases = ["NICE", "GREAT", "SUPER", "AMAZING", "GENIUS"];
    comboBanner.textContent = phrases[Math.min(n - 2, phrases.length - 1)] + "!";
    comboBanner.classList.remove("show");
    void comboBanner.offsetWidth;
    comboBanner.classList.add("show");
  }

  function checkWin() {
    if (!levelData) return;
    if (complete.size < levelData.pairCount) return;

    // Also require every cell filled? Classic Flow Free does.
    // Check full board coverage by paths
    const filled = new Set();
    paths.forEach((cells) => {
      cells.forEach(({ r, c }) => filled.add(cellKey(r, c)));
    });
    const totalCells = levelData.size * levelData.size;
    if (filled.size < totalCells) {
      // Not fully filled — still require all pairs connected for win
      // Flow Free rules: all pairs connected AND every cell used
      // Soft mode: all pairs connected is enough for early levels
      if (level >= 3 && filled.size < totalCells * 0.95) {
        // nudge player — optional strictness for higher levels
        // For better UX, win when all pairs connected (paths may not cover all if gen left gaps)
      }
    }

    // Win when all pairs connected
    doWin();
  }

  function doWin() {
    if (won) return;
    won = true;
    running = false;
    boardGlow.classList.add("win");
    Renderer.flashBoard(0.5);
    AudioSys.play("win");

    // Celebration particles
    for (let i = 0; i < levelData.pairCount; i++) {
      const ep = levelData.endpoints[i];
      const col = colorMap.get(ep.colorId);
      setTimeout(() => {
        Renderer.spawnBurst(ep.a.r, ep.a.c, col.hex, 16);
        Renderer.spawnBurst(ep.b.r, ep.b.c, col.hex, 16);
      }, i * 80);
    }

    // Stars: time + hints + moves
    const timeLimit = levelData.size * levelData.pairCount * 8;
    let stars = 1;
    if (hintsUsed === 0) stars++;
    if (elapsed <= timeLimit * 0.55 && hintsUsed === 0) stars++;
    if (stars < 2 && elapsed <= timeLimit * 0.8) stars = Math.max(stars, 2);

    const starEls = $("#win-stars").querySelectorAll(".star");
    starEls.forEach((el, i) => {
      el.classList.toggle("lit", i < stars);
      if (i < stars) {
        setTimeout(() => AudioSys.play("star", { n: i }), 400 + i * 180);
      }
    });

    $("#win-time").textContent = formatTime(elapsed);
    $("#win-moves").textContent = String(moves);
    $("#win-hints").textContent = String(hintsUsed);

    stats.totalWins++;
    stats.currentLevel = level + 1;
    stats.bestLevel = Math.max(stats.bestLevel, level, stats.currentLevel);
    saveStats(stats);
    refreshTitleStats();

    setTimeout(() => overlayWin.classList.add("show"), 450);
  }

  function useHint() {
    if (!levelData || won || !running) return;
    // Find first incomplete pair
    const incomplete = levelData.solution.find((s) => !complete.has(s.colorId));
    if (!incomplete) return;

    hintsUsed++;
    hint = { colorId: incomplete.colorId, cells: incomplete.cells };
    hintTimer = 3.5;
    AudioSys.play("hint");

    const col = colorMap.get(incomplete.colorId);
    const a = incomplete.cells[0];
    Renderer.spawnBurst(a.r, a.c, col.hex, 10);
    Renderer.spawnFloatText("HINT", a.r, a.c, col.hex);
  }

  function undo() {
    if (won) return;
    if (drawing) {
      draft = null;
      draftColor = null;
      drawing = false;
      AudioSys.play("undo");
      return;
    }
    // Undo last completed/partial path change
    // Remove most recently modified path
    if (pathHistory.length) {
      const prev = pathHistory.pop();
      if (prev.cells && prev.cells.length) {
        paths.set(prev.colorId, prev.cells);
        // Re-evaluate complete
        const cells = prev.cells;
        const start = cells[0];
        const end = cells[cells.length - 1];
        const ok =
          endpointColor(start.r, start.c) === prev.colorId &&
          endpointColor(end.r, end.c) === prev.colorId &&
          cells.length >= 2 &&
          !(start.r === end.r && start.c === end.c);
        if (ok) complete.add(prev.colorId);
        else complete.delete(prev.colorId);
      } else {
        paths.delete(prev.colorId);
        complete.delete(prev.colorId);
      }
      rebuildOccupancy();
      updateProgress();
      AudioSys.play("undo");
      return;
    }

    // Fallback: remove last path in insertion order
    const keys = [...paths.keys()];
    if (!keys.length) return;
    const last = keys[keys.length - 1];
    paths.delete(last);
    complete.delete(last);
    rebuildOccupancy();
    updateProgress();
    AudioSys.play("undo");
  }

  function resetLevel() {
    startLevel(level, levelData ? levelData.seed : undefined);
    AudioSys.play("ui");
  }

  function newLayout() {
    startLevel(level); // new seed
    AudioSys.play("levelup");
  }

  // ── Input binding ──
  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp, { passive: false });
  window.addEventListener("touchcancel", onPointerUp, { passive: false });

  // Prevent scroll on canvas
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

  // ── UI buttons ──
  $("#btn-play").addEventListener("click", async () => {
    await AudioSys.unlock();
    AudioSys.startAmbient();
    AudioSys.play("ui");
    startLevel(stats.currentLevel || 1);
    showScreen("game");
  });

  $("#btn-how").addEventListener("click", () => {
    AudioSys.play("ui");
    showScreen("how");
  });
  $("#btn-how-back").addEventListener("click", () => {
    AudioSys.play("ui");
    showScreen("title");
  });

  $("#btn-mute").addEventListener("click", () => {
    AudioSys.setMuted(!AudioSys.isMuted());
    updateMuteButtons();
    if (!AudioSys.isMuted()) AudioSys.play("ui");
  });
  $("#btn-mute-title").addEventListener("click", async () => {
    await AudioSys.unlock();
    AudioSys.setMuted(!AudioSys.isMuted());
    updateMuteButtons();
    if (!AudioSys.isMuted()) {
      AudioSys.startAmbient();
      AudioSys.play("ui");
    }
  });

  $("#btn-menu").addEventListener("click", () => {
    if (won) return;
    overlayMenu.classList.add("show");
    AudioSys.play("ui");
  });
  $("#btn-resume").addEventListener("click", () => {
    overlayMenu.classList.remove("show");
    AudioSys.play("ui");
  });
  $("#btn-restart-level").addEventListener("click", () => {
    overlayMenu.classList.remove("show");
    resetLevel();
  });
  $("#btn-to-title").addEventListener("click", () => {
    overlayMenu.classList.remove("show");
    running = false;
    showScreen("title");
    refreshTitleStats();
    AudioSys.play("ui");
  });

  $("#btn-undo").addEventListener("click", undo);
  $("#btn-hint").addEventListener("click", useHint);
  $("#btn-reset").addEventListener("click", resetLevel);
  $("#btn-skip").addEventListener("click", newLayout);

  $("#btn-next").addEventListener("click", () => {
    overlayWin.classList.remove("show");
    AudioSys.play("levelup");
    startLevel(level + 1);
  });
  $("#btn-win-menu").addEventListener("click", () => {
    overlayWin.classList.remove("show");
    showScreen("title");
    refreshTitleStats();
    AudioSys.play("ui");
  });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    } else if (e.key === "h" || e.key === "H") {
      useHint();
    } else if (e.key === "r" || e.key === "R") {
      resetLevel();
    } else if (e.key === "Escape") {
      if (overlayWin.classList.contains("show")) return;
      if (overlayMenu.classList.contains("show")) {
        overlayMenu.classList.remove("show");
      } else if (screens.game.classList.contains("active")) {
        overlayMenu.classList.add("show");
      }
    }
  });

  // ── Main loop ──
  function frame(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;

    if (running && !won && !overlayMenu.classList.contains("show")) {
      elapsed += dt;
      timerEl.textContent = formatTime(elapsed);
    }

    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) hint = null;
    }

    Renderer.update(dt);
    Renderer.render({
      size: levelData ? levelData.size : 5,
      grid: levelData ? levelData.grid : null,
      paths,
      complete,
      draft,
      draftColor,
      colorMap,
      hint,
      hover,
    });

    requestAnimationFrame(frame);
  }

  // Boot
  Renderer.init(canvas);
  // Idle title render with empty board aesthetic
  levelData = LevelGen.generate(1, 42);
  colorMap.clear();
  levelData.colors.forEach((c) => colorMap.set(c.id, c));
  Renderer.setSize(levelData.size);
  // Don't show game screen paths until play
  levelData = null;

  requestAnimationFrame(frame);

  // First interaction unlocks audio
  ["pointerdown", "keydown"].forEach((ev) => {
    window.addEventListener(ev, () => AudioSys.unlock(), { once: true });
  });
})();
