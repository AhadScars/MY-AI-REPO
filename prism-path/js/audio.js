/**
 * Prism Path — Web Audio sound design
 * Procedural SFX + soft ambient pad (no external files).
 */
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambientNodes = null;
  let unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  async function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === "suspended") {
      try { await c.resume(); } catch (_) { /* ignore */ }
    }
    unlocked = true;
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.55;
    try { localStorage.setItem("prism_muted", muted ? "1" : "0"); } catch (_) {}
    if (muted) stopAmbient();
    else if (unlocked) startAmbient();
  }

  function isMuted() { return muted; }

  function loadMutePref() {
    try { muted = localStorage.getItem("prism_muted") === "1"; } catch (_) {}
  }

  function tone(freq, type, start, dur, vol, dest) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  function noiseBurst(start, dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filterFreq || 1200;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function play(name, opts = {}) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + 0.001;

    switch (name) {
      case "tap": {
        tone(520 + (opts.pitch || 0), "sine", t, 0.06, 0.12);
        tone(780 + (opts.pitch || 0), "triangle", t, 0.04, 0.05);
        break;
      }
      case "draw": {
        const p = opts.pitch || 0;
        tone(280 + p * 40, "sine", t, 0.05, 0.04);
        break;
      }
      case "connect": {
        tone(440, "sine", t, 0.12, 0.14);
        tone(660, "triangle", t + 0.04, 0.15, 0.1);
        tone(880, "sine", t + 0.08, 0.2, 0.08);
        noiseBurst(t, 0.08, 0.06, 2000);
        break;
      }
      case "erase": {
        tone(320, "sawtooth", t, 0.1, 0.06);
        tone(180, "sine", t + 0.02, 0.12, 0.08);
        break;
      }
      case "error": {
        tone(180, "square", t, 0.1, 0.07);
        tone(140, "square", t + 0.08, 0.14, 0.06);
        break;
      }
      case "hint": {
        tone(600, "sine", t, 0.1, 0.1);
        tone(900, "sine", t + 0.1, 0.15, 0.08);
        tone(1200, "triangle", t + 0.2, 0.2, 0.06);
        break;
      }
      case "win": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => {
          tone(f, "sine", t + i * 0.1, 0.35, 0.12);
          tone(f * 2, "triangle", t + i * 0.1, 0.25, 0.04);
        });
        noiseBurst(t + 0.3, 0.25, 0.08, 3000);
        break;
      }
      case "star": {
        const n = opts.n || 0;
        tone(880 + n * 220, "sine", t, 0.2, 0.1);
        tone(1320 + n * 220, "triangle", t + 0.05, 0.18, 0.05);
        break;
      }
      case "levelup": {
        [392, 494, 587, 784, 988].forEach((f, i) => {
          tone(f, "sine", t + i * 0.07, 0.2, 0.09);
        });
        break;
      }
      case "ui": {
        tone(700, "sine", t, 0.05, 0.08);
        break;
      }
      case "undo": {
        tone(400, "triangle", t, 0.08, 0.08);
        tone(300, "sine", t + 0.05, 0.1, 0.06);
        break;
      }
      default:
        break;
    }
  }

  function startAmbient() {
    if (!ensure() || muted || ambientNodes) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0.028;
    g.connect(master);

    const notes = [130.81, 164.81, 196.0, 246.94]; // C3 E3 G3 B3 soft pad
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.25 + (i % 2) * 0.1;
      // gentle LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.03;
      const lfog = ctx.createGain();
      lfog.gain.value = 0.08;
      lfo.connect(lfog);
      lfog.connect(og.gain);
      o.connect(og);
      og.connect(g);
      o.start(t);
      lfo.start(t);
      return { o, lfo, og };
    });

    // Slow filter sweep
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    // rewire: oscs -> g is already connected; leave simple
    ambientNodes = { g, oscs };
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    try {
      ambientNodes.oscs.forEach(({ o, lfo }) => {
        o.stop();
        lfo.stop();
      });
    } catch (_) {}
    ambientNodes = null;
  }

  loadMutePref();

  return {
    unlock,
    play,
    setMuted,
    isMuted,
    startAmbient,
    stopAmbient,
    ensure,
  };
})();
