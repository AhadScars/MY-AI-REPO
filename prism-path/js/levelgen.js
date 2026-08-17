/**
 * Prism Path — procedural solvable level generator
 * Strategy: carve non-overlapping solution paths first, expose only endpoints.
 */
const LevelGen = (() => {
  const PALETTE = [
    { id: 0, name: "rose",   hex: "#ff6bcb", rgb: [255, 107, 203] },
    { id: 1, name: "azure",  hex: "#6b8cff", rgb: [107, 140, 255] },
    { id: 2, name: "mint",   hex: "#5ef0c0", rgb: [94, 240, 192] },
    { id: 3, name: "gold",   hex: "#ffd166", rgb: [255, 209, 102] },
    { id: 4, name: "violet", hex: "#c77dff", rgb: [199, 125, 255] },
    { id: 5, name: "coral",  hex: "#ff8a65", rgb: [255, 138, 101] },
    { id: 6, name: "sky",    hex: "#4fd1ff", rgb: [79, 209, 255] },
    { id: 7, name: "lime",   hex: "#a8e63d", rgb: [168, 230, 61] },
    { id: 8, name: "peach",  hex: "#ff9ecd", rgb: [255, 158, 205] },
    { id: 9, name: "indigo", hex: "#7c6bff", rgb: [124, 107, 255] },
  ];

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function key(r, c) { return r + "," + c; }

  function neighbors(r, c, size) {
    const out = [];
    if (r > 0) out.push([r - 1, c]);
    if (r < size - 1) out.push([r + 1, c]);
    if (c > 0) out.push([r, c - 1]);
    if (c < size - 1) out.push([r, c + 1]);
    return out;
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function levelParams(level) {
    // Progressive difficulty curve
    const size = Math.min(9, 4 + Math.floor((level - 1) / 2) + (level >= 12 ? 1 : 0));
    // number of pairs: scale with board cells
    const maxPairs = Math.floor((size * size) / 3);
    const basePairs = Math.min(PALETTE.length, 2 + Math.floor((level - 1) / 1.5));
    const pairs = Math.min(maxPairs, Math.max(2, Math.min(basePairs, Math.floor(size * size * 0.28))));
    // longer min path length at higher levels
    const minPath = Math.min(size, 2 + Math.floor(level / 4));
    return { size, pairs, minPath };
  }

  /**
   * Try to grow a path of at least minLen from empty cells.
   * Returns array of [r,c] or null.
   */
  function growPath(occupied, size, minLen, rng, maxAttempts = 40) {
    const free = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!occupied.has(key(r, c))) free.push([r, c]);
      }
    }
    if (free.length < minLen) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const start = free[Math.floor(rng() * free.length)];
      const path = [start];
      const used = new Set([key(start[0], start[1])]);
      let stuck = false;

      while (path.length < minLen + Math.floor(rng() * (size + 1)) && !stuck) {
        const [cr, cc] = path[path.length - 1];
        let opts = neighbors(cr, cc, size).filter(([nr, nc]) => {
          const k = key(nr, nc);
          return !occupied.has(k) && !used.has(k);
        });
        // Prefer continuing into emptier areas / avoid early self-box
        if (opts.length === 0) {
          stuck = true;
          break;
        }
        // Bias: pick cells with more free neighbors (less dead-ends early)
        opts = shuffle(opts, rng);
        opts.sort((a, b) => {
          const fa = neighbors(a[0], a[1], size).filter(([nr, nc]) => {
            const k = key(nr, nc);
            return !occupied.has(k) && !used.has(k);
          }).length;
          const fb = neighbors(b[0], b[1], size).filter(([nr, nc]) => {
            const k = key(nr, nc);
            return !occupied.has(k) && !used.has(k);
          }).length;
          return fb - fa;
        });
        // sometimes pick 2nd best for variety
        const pick = opts[Math.floor(rng() * Math.min(2, opts.length))];
        path.push(pick);
        used.add(key(pick[0], pick[1]));
      }

      if (path.length >= minLen) return path;

      // Try extend a short path a bit more aggressively
      if (path.length >= 2) {
        // accept shorter paths later when board fills
        if (path.length >= Math.max(2, minLen - 1) && attempt > maxAttempts / 2) {
          return path;
        }
      }
    }
    return null;
  }

  /**
   * Fill remaining empty cells by extending existing paths where possible,
   * or by placing short connector paths. Ensures high board coverage.
   */
  function fillRemaining(paths, occupied, size, rng) {
    let freeCount = size * size - occupied.size;
    let guard = 0;
    while (freeCount > 0 && guard++ < 200) {
      // Try extend an existing path endpoint
      let extended = false;
      const order = shuffle(paths.map((_, i) => i), rng);
      for (const pi of order) {
        const path = paths[pi];
        for (const end of [path[path.length - 1], path[0]]) {
          const opts = neighbors(end[0], end[1], size).filter(
            ([nr, nc]) => !occupied.has(key(nr, nc))
          );
          if (opts.length) {
            const pick = opts[Math.floor(rng() * opts.length)];
            if (end === path[path.length - 1]) path.push(pick);
            else path.unshift(pick);
            occupied.add(key(pick[0], pick[1]));
            freeCount--;
            extended = true;
            break;
          }
        }
        if (extended) break;
      }
      if (extended) continue;

      // Place a new short path if free cells remain and we have palette room
      if (paths.length >= PALETTE.length) break;
      const short = growPath(occupied, size, 2, rng, 20);
      if (!short) break;
      paths.push(short);
      short.forEach(([r, c]) => occupied.add(key(r, c)));
      freeCount = size * size - occupied.size;
    }
  }

  function generate(level, seed) {
    const s = seed != null ? seed : (level * 9973 + Date.now()) >>> 0;
    const rng = mulberry32(s);
    const { size, pairs: targetPairs, minPath } = levelParams(level);

    let best = null;

    for (let tryN = 0; tryN < 12; tryN++) {
      const occupied = new Set();
      const paths = [];
      let ok = true;

      for (let p = 0; p < targetPairs; p++) {
        const minLen = p === 0 ? Math.max(minPath, 3) : Math.max(2, minPath - (p > 3 ? 1 : 0));
        const path = growPath(occupied, size, minLen, rng);
        if (!path) {
          ok = false;
          break;
        }
        paths.push(path);
        path.forEach(([r, c]) => occupied.add(key(r, c)));
      }

      if (!ok || paths.length < 2) continue;

      fillRemaining(paths, occupied, size, rng);

      // Coverage score
      const coverage = occupied.size / (size * size);
      const score = coverage * 100 + paths.length * 5;
      if (!best || score > best.score) {
        best = { paths, size, coverage, score, seed: s + tryN };
      }
      // Good enough
      if (coverage >= 0.85 && paths.length >= targetPairs) break;
    }

    if (!best) {
      // Fallback tiny level
      return generateFallback(level, s);
    }

    const colors = PALETTE.slice(0, best.paths.length);
    // Shuffle color assignment for variety
    shuffle(colors, rng);

    const endpoints = [];
    const solution = []; // colorId -> path cells

    best.paths.forEach((path, i) => {
      const colorId = colors[i].id;
      const cells = path.map(([r, c]) => ({ r, c }));
      solution.push({ colorId, cells });
      endpoints.push({
        colorId,
        a: { r: path[0][0], c: path[0][1] },
        b: { r: path[path.length - 1][0], c: path[path.length - 1][1] },
      });
    });

    // Grid of endpoint color ids (-1 empty)
    const grid = Array.from({ length: best.size }, () =>
      Array(best.size).fill(-1)
    );
    endpoints.forEach((ep) => {
      grid[ep.a.r][ep.a.c] = ep.colorId;
      grid[ep.b.r][ep.b.c] = ep.colorId;
    });

    return {
      level,
      size: best.size,
      seed: best.seed,
      colors: colors.map((c) => ({ ...c })),
      endpoints,
      grid,
      solution, // for hints
      pairCount: endpoints.length,
      coverage: best.coverage,
    };
  }

  function generateFallback(level, seed) {
    const size = 4;
    const grid = Array.from({ length: size }, () => Array(size).fill(-1));
    // Two simple pairs
    grid[0][0] = 0; grid[0][3] = 0;
    grid[3][0] = 1; grid[3][3] = 1;
    grid[1][1] = 2; grid[2][2] = 2;
    return {
      level,
      size,
      seed,
      colors: PALETTE.slice(0, 3).map((c) => ({ ...c })),
      endpoints: [
        { colorId: 0, a: { r: 0, c: 0 }, b: { r: 0, c: 3 } },
        { colorId: 1, a: { r: 3, c: 0 }, b: { r: 3, c: 3 } },
        { colorId: 2, a: { r: 1, c: 1 }, b: { r: 2, c: 2 } },
      ],
      grid,
      solution: [
        { colorId: 0, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }] },
        { colorId: 1, cells: [{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }, { r: 3, c: 3 }] },
        { colorId: 2, cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }] },
      ],
      pairCount: 3,
      coverage: 0.7,
    };
  }

  function colorById(id) {
    return PALETTE.find((c) => c.id === id) || PALETTE[0];
  }

  return { generate, levelParams, colorById, PALETTE };
})();
