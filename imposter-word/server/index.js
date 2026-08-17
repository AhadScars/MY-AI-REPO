import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import os from "os";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { CATEGORIES, pickWord, shuffle } from "./words.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3850;
const SPEAK_SECONDS = 60;
const REVEAL_SECONDS = 8;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

const COLORS = [
  "#e85d4c",
  "#3d8bfd",
  "#2f9e6b",
  "#c77d1a",
  "#7c5cbf",
  "#d63384",
  "#0d9488",
  "#b45309",
  "#4f46e5",
  "#be123c",
];

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

/** @type {Map<string, any>} */
const rooms = new Map();

function lanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function clearTimers(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  if (room.tick) {
    clearInterval(room.tick);
    room.tick = null;
  }
}

function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    connected: p.connected,
    spoken: !!p.spoken,
    isHost: p.id === room.hostId,
  }));
}

/** Safe snapshot — never leaks secret word or who is imposter until results */
function snapshot(room, forId) {
  const me = room.players.find((p) => p.id === forId);
  const base = {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    category: room.category,
    speakSeconds: room.speakSeconds,
    players: publicPlayers(room),
    minPlayers: MIN_PLAYERS,
    turnOrder: room.turnOrder,
    currentSpeakerId: room.currentSpeakerId,
    turnEndsAt: room.turnEndsAt,
    speakSecondsLeft: room.speakSecondsLeft,
    votes: room.phase === "vote" || room.phase === "results" ? room.votes : undefined,
    myVote: me ? room.votes[forId] : null,
  };

  if (room.phase === "reveal" || room.phase === "discussion") {
    if (me) {
      base.myRole = me.role;
      base.secretWord = me.role === "civilian" ? room.secretWord : null;
      base.imposterHint = me.role === "imposter" ? room.categoryLabel : null;
    }
  }

  if (room.phase === "results") {
    base.secretWord = room.secretWord;
    base.imposterIds = room.players.filter((p) => p.role === "imposter").map((p) => p.id);
    base.voteTally = tallyVotes(room);
    base.civiliansWin = room.civiliansWin;
  }

  return base;
}

function tallyVotes(room) {
  const t = {};
  for (const target of Object.values(room.votes)) {
    if (!target) continue;
    t[target] = (t[target] || 0) + 1;
  }
  return t;
}

function emitAll(room) {
  for (const p of room.players) {
    if (p.connected) {
      io.to(p.id).emit("room:state", snapshot(room, p.id));
    }
  }
}

function advanceSpeaker(room) {
  clearTimers(room);
  const order = room.turnOrder;
  let idx = room.turnIndex + 1;

  // Skip disconnected
  while (idx < order.length) {
    const p = room.players.find((x) => x.id === order[idx]);
    if (p && p.connected) break;
    idx += 1;
  }

  if (idx >= order.length) {
    room.phase = "vote";
    room.currentSpeakerId = null;
    room.turnEndsAt = null;
    room.speakSecondsLeft = 0;
    room.votes = {};
    emitAll(room);
    return;
  }

  room.turnIndex = idx;
  room.currentSpeakerId = order[idx];
  const speaker = room.players.find((p) => p.id === room.currentSpeakerId);
  if (speaker) speaker.spoken = true;

  room.speakSecondsLeft = room.speakSeconds;
  room.turnEndsAt = Date.now() + room.speakSeconds * 1000;

  room.tick = setInterval(() => {
    room.speakSecondsLeft = Math.max(
      0,
      Math.ceil((room.turnEndsAt - Date.now()) / 1000)
    );
    io.to(room.code).emit("timer:tick", {
      currentSpeakerId: room.currentSpeakerId,
      secondsLeft: room.speakSecondsLeft,
      turnEndsAt: room.turnEndsAt,
    });
  }, 250);

  room.timer = setTimeout(() => {
    advanceSpeaker(room);
  }, room.speakSeconds * 1000);

  emitAll(room);
}

function startDiscussion(room) {
  clearTimers(room);
  room.phase = "discussion";
  room.turnIndex = -1;
  room.turnOrder = shuffle(
    room.players.filter((p) => p.connected).map((p) => p.id)
  );
  for (const p of room.players) p.spoken = false;
  advanceSpeaker(room);
}

function startRound(room) {
  clearTimers(room);
  const connected = room.players.filter((p) => p.connected);
  if (connected.length < MIN_PLAYERS) return false;

  room.secretWord = pickWord(room.category);
  room.categoryLabel =
    CATEGORIES.find((c) => c.id === room.category)?.label || room.category;
  room.votes = {};
  room.civiliansWin = null;

  // 1 imposter; 2 if 7+ players
  const imposterCount = connected.length >= 7 ? 2 : 1;
  const ids = shuffle(connected.map((p) => p.id));
  const imposterSet = new Set(ids.slice(0, imposterCount));

  for (const p of room.players) {
    p.role = imposterSet.has(p.id) ? "imposter" : "civilian";
    p.spoken = false;
  }

  room.phase = "reveal";
  room.currentSpeakerId = null;
  room.turnOrder = [];
  room.turnIndex = -1;
  room.speakSecondsLeft = REVEAL_SECONDS;
  room.turnEndsAt = Date.now() + REVEAL_SECONDS * 1000;

  emitAll(room);

  room.timer = setTimeout(() => {
    startDiscussion(room);
  }, REVEAL_SECONDS * 1000);

  return true;
}

function finishVote(room) {
  clearTimers(room);
  const tally = tallyVotes(room);
  let max = 0;
  let top = [];
  for (const [id, n] of Object.entries(tally)) {
    if (n > max) {
      max = n;
      top = [id];
    } else if (n === max) top.push(id);
  }

  // Tie or no votes → imposters escape (civilians lose)
  const imposters = room.players.filter((p) => p.role === "imposter").map((p) => p.id);
  if (top.length !== 1 || max === 0) {
    room.civiliansWin = false;
  } else {
    room.civiliansWin = imposters.includes(top[0]);
  }

  room.phase = "results";
  room.currentSpeakerId = null;
  emitAll(room);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/api/network", (_req, res) => {
  const ips = lanIPs();
  res.json({
    port: PORT,
    ips,
    urls: ips.map((ip) => `http://${ip}:${PORT}`),
  });
});

app.get("/api/categories", (_req, res) => {
  res.json(CATEGORIES);
});

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.data.roomCode = null;

  socket.on("host:create", (payload, cb) => {
    try {
      const name = String(payload?.name || "Host").trim().slice(0, 14) || "Host";
      const category = payload?.category || "mixed";
      const speakSeconds = Math.min(
        120,
        Math.max(30, Number(payload?.speakSeconds) || SPEAK_SECONDS)
      );

      let roomCode = code();
      while (rooms.has(roomCode)) roomCode = code();

      const room = {
        code: roomCode,
        hostId: socket.id,
        phase: "lobby",
        category,
        categoryLabel: CATEGORIES.find((c) => c.id === category)?.label || category,
        speakSeconds,
        secretWord: null,
        players: [
          {
            id: socket.id,
            name,
            color: COLORS[0],
            connected: true,
            role: null,
            spoken: false,
          },
        ],
        turnOrder: [],
        turnIndex: -1,
        currentSpeakerId: null,
        turnEndsAt: null,
        speakSecondsLeft: 0,
        votes: {},
        civiliansWin: null,
        timer: null,
        tick: null,
      };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;

      const ips = lanIPs();
      cb?.({
        ok: true,
        room: snapshot(room, socket.id),
        joinUrls: ips.map((ip) => `http://${ip}:${PORT}?join=${roomCode}`),
        joinCode: roomCode,
      });
      emitAll(room);
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("player:join", (payload, cb) => {
    try {
      const roomCode = String(payload?.code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
      const name = String(payload?.name || "Player").trim().slice(0, 14) || "Player";
      const room = rooms.get(roomCode);
      if (!room) return cb?.({ ok: false, error: "Room not found" });
      if (room.phase !== "lobby") return cb?.({ ok: false, error: "Game already running" });
      if (room.players.filter((p) => p.connected).length >= MAX_PLAYERS) {
        return cb?.({ ok: false, error: `Room full (${MAX_PLAYERS})` });
      }
      if (room.players.some((p) => p.connected && p.name.toLowerCase() === name.toLowerCase())) {
        return cb?.({ ok: false, error: "Name taken" });
      }

      room.players.push({
        id: socket.id,
        name,
        color: COLORS[room.players.length % COLORS.length],
        connected: true,
        role: null,
        spoken: false,
      });
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      cb?.({ ok: true, room: snapshot(room, socket.id) });
      emitAll(room);
      // Tell others a peer joined for WebRTC
      socket.to(roomCode).emit("voice:peer-joined", { id: socket.id, name });
    } catch (e) {
      cb?.({ ok: false, error: e.message });
    }
  });

  socket.on("host:settings", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") {
      return cb?.({ ok: false, error: "Not allowed" });
    }
    if (payload.category) {
      room.category = payload.category;
      room.categoryLabel =
        CATEGORIES.find((c) => c.id === payload.category)?.label || payload.category;
    }
    if (payload.speakSeconds) {
      room.speakSeconds = Math.min(120, Math.max(30, Number(payload.speakSeconds)));
    }
    cb?.({ ok: true });
    emitAll(room);
  });

  socket.on("host:start", (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) {
      return cb?.({ ok: false, error: "Only host can start" });
    }
    if (room.phase !== "lobby" && room.phase !== "results") {
      return cb?.({ ok: false, error: "Already in a round" });
    }
    const n = room.players.filter((p) => p.connected).length;
    if (n < MIN_PLAYERS) {
      return cb?.({ ok: false, error: `Need at least ${MIN_PLAYERS} players` });
    }
    const ok = startRound(room);
    cb?.({ ok });
  });

  socket.on("host:skip-turn", (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.phase !== "discussion") {
      return cb?.({ ok: false, error: "Not allowed" });
    }
    advanceSpeaker(room);
    cb?.({ ok: true });
  });

  socket.on("vote:cast", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== "vote") {
      return cb?.({ ok: false, error: "Not voting now" });
    }
    const me = room.players.find((p) => p.id === socket.id);
    if (!me || !me.connected) return cb?.({ ok: false, error: "Not in room" });

    const target = String(payload?.targetId || "");
    if (target === socket.id) return cb?.({ ok: false, error: "Can't vote yourself" });
    if (!room.players.some((p) => p.id === target && p.connected)) {
      return cb?.({ ok: false, error: "Invalid target" });
    }

    room.votes[socket.id] = target;
    cb?.({ ok: true });
    emitAll(room);

    const voters = room.players.filter((p) => p.connected);
    if (voters.every((p) => room.votes[p.id])) {
      finishVote(room);
    }
  });

  socket.on("host:lobby", (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) {
      return cb?.({ ok: false, error: "Only host" });
    }
    clearTimers(room);
    room.phase = "lobby";
    room.secretWord = null;
    room.votes = {};
    room.currentSpeakerId = null;
    room.turnOrder = [];
    for (const p of room.players) {
      p.role = null;
      p.spoken = false;
    }
    cb?.({ ok: true });
    emitAll(room);
  });

  // —— WebRTC signaling (mesh) ——
  socket.on("voice:signal", ({ to, data }) => {
    if (!to || !data) return;
    io.to(to).emit("voice:signal", { from: socket.id, data });
  });

  socket.on("voice:ready", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const others = room.players
      .filter((p) => p.connected && p.id !== socket.id)
      .map((p) => ({ id: p.id, name: p.name }));
    socket.emit("voice:peers", { peers: others });
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) player.connected = false;

    io.to(roomCode).emit("voice:peer-left", { id: socket.id });

    if (socket.id === room.hostId && (room.phase === "lobby" || room.phase === "results")) {
      clearTimers(room);
      io.to(roomCode).emit("room:closed", { reason: "Host left" });
      rooms.delete(roomCode);
      return;
    }

    if (room.phase === "lobby") {
      room.players = room.players.filter((p) => p.id !== socket.id);
      if (!room.players.length) {
        clearTimers(room);
        rooms.delete(roomCode);
        return;
      }
      if (room.hostId === socket.id && room.players[0]) {
        room.hostId = room.players.find((p) => p.connected)?.id || room.players[0].id;
      }
    }

    // If current speaker left mid-turn, skip
    if (room.phase === "discussion" && room.currentSpeakerId === socket.id) {
      advanceSpeaker(room);
    } else {
      emitAll(room);
    }

    // Vote: if all remaining voted
    if (room.phase === "vote") {
      const voters = room.players.filter((p) => p.connected);
      if (voters.length && voters.every((p) => room.votes[p.id])) {
        finishVote(room);
      }
    }
  });
});

setInterval(() => {
  for (const [c, room] of rooms) {
    if (!room.players.some((p) => p.connected)) {
      clearTimers(room);
      rooms.delete(c);
    }
  }
}, 60_000);

httpServer.listen(PORT, "0.0.0.0", () => {
  const ips = lanIPs();
  console.log("\n  🕵️  Imposter Word\n");
  console.log(`  Local:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  WiFi:   http://${ip}:${PORT}`);
  console.log(`\n  Min ${MIN_PLAYERS} players · ${SPEAK_SECONDS}s each · voice chat\n`);
});
