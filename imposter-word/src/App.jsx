import { useEffect, useMemo, useRef, useState } from "react";
import { socket, onceConnected } from "./socket";
import { VoiceMesh } from "./voice";

const CATEGORIES = [
  { id: "mixed", label: "Mixed" },
  { id: "places", label: "Places" },
  { id: "food", label: "Food" },
  { id: "objects", label: "Objects" },
  { id: "movies", label: "Movies" },
  { id: "sports", label: "Sports" },
];

function useJoinCode() {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return (p.get("join") || "").toUpperCase();
  }, []);
}

function SpeakerRing({ secondsLeft, total, name, color, isMe }) {
  const pct = total ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="speaker-ring-wrap">
      <svg className="speaker-ring" viewBox="0 0 120 120">
        <circle className="ring-bg" cx="60" cy="60" r={r} />
        <circle
          className="ring-fg"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={`${dash} ${c}`}
          style={{ stroke: color }}
        />
      </svg>
      <div className="speaker-core">
        <div className="speaker-name" style={{ color }}>
          {name}
          {isMe ? " (you)" : ""}
        </div>
        <div className="speaker-time">{secondsLeft}s</div>
        <div className="speaker-label">speaking</div>
      </div>
    </div>
  );
}

export default function App() {
  const prefill = useJoinCode();
  const [connected, setConnected] = useState(socket.connected);
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState(() => localStorage.getItem("iw_name") || "");
  const [joinCode, setJoinCode] = useState(prefill);
  const [category, setCategory] = useState("mixed");
  const [speakSeconds, setSpeakSeconds] = useState(60);
  const [room, setRoom] = useState(null);
  const [joinUrls, setJoinUrls] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const voiceRef = useRef(null);

  const meId = socket.id;

  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, []);

  useEffect(() => {
    const voice = new VoiceMesh(socket);
    voiceRef.current = voice;
    return () => voice.destroy();
  }, []);

  useEffect(() => {
    const onState = (snap) => {
      setRoom(snap);
      if (snap.speakSecondsLeft != null) setSecondsLeft(snap.speakSecondsLeft);
      if (snap.phase === "lobby") setScreen("lobby");
      else if (snap.phase === "reveal") setScreen("reveal");
      else if (snap.phase === "discussion") setScreen("discussion");
      else if (snap.phase === "vote") setScreen("vote");
      else if (snap.phase === "results") setScreen("results");
    };
    const onTick = ({ secondsLeft: s }) => setSecondsLeft(s);
    const onClosed = ({ reason }) => {
      setError(reason || "Room closed");
      setRoom(null);
      setIsHost(false);
      setScreen("home");
      voiceRef.current?.destroy();
      voiceRef.current = new VoiceMesh(socket);
    };
    socket.on("room:state", onState);
    socket.on("timer:tick", onTick);
    socket.on("room:closed", onClosed);
    return () => {
      socket.off("room:state", onState);
      socket.off("timer:tick", onTick);
      socket.off("room:closed", onClosed);
    };
  }, []);

  const saveName = (n) => {
    setName(n);
    localStorage.setItem("iw_name", n);
  };

  const enableMic = async () => {
    setError("");
    const ok = await voiceRef.current?.enable();
    setMicOn(!!ok);
    if (!ok) setError("Microphone permission is required to talk with the group.");
    return ok;
  };

  const createRoom = async () => {
    setError("");
    if (!name.trim()) return setError("Enter your name");
    setBusy(true);
    await onceConnected();
    const mic = await enableMic();
    if (!mic) {
      setBusy(false);
      return;
    }
    socket.emit(
      "host:create",
      { name: name.trim(), category, speakSeconds },
      (res) => {
        setBusy(false);
        if (!res?.ok) return setError(res?.error || "Create failed");
        setIsHost(true);
        setRoom(res.room);
        setJoinUrls(res.joinUrls || []);
        setScreen("lobby");
      }
    );
  };

  const joinRoom = async () => {
    setError("");
    if (!name.trim()) return setError("Enter your name");
    if (!joinCode.trim()) return setError("Enter room code");
    setBusy(true);
    await onceConnected();
    const mic = await enableMic();
    if (!mic) {
      setBusy(false);
      return;
    }
    socket.emit(
      "player:join",
      { name: name.trim(), code: joinCode.trim() },
      (res) => {
        setBusy(false);
        if (!res?.ok) return setError(res?.error || "Join failed");
        setIsHost(false);
        setRoom(res.room);
        setScreen("lobby");
        if (window.location.search) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    );
  };

  const startGame = () => {
    setBusy(true);
    socket.emit("host:start", {}, (res) => {
      setBusy(false);
      if (!res?.ok) setError(res?.error || "Need at least 3 players");
    });
  };

  const castVote = (targetId) => {
    socket.emit("vote:cast", { targetId }, (res) => {
      if (!res?.ok) setError(res?.error || "Vote failed");
    });
  };

  const toggleMute = () => {
    const m = voiceRef.current?.toggleMute();
    setMuted(!!m);
  };

  const copyLink = async () => {
    const url = joinUrls[0];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setError("Link copied!");
      setTimeout(() => setError((e) => (e === "Link copied!" ? "" : e)), 1200);
    } catch {
      setError(url);
    }
  };

  const speaker = room?.players?.find((p) => p.id === room.currentSpeakerId);
  const totalSpeak = room?.speakSeconds || 60;

  /* —— HOME —— */
  if (screen === "home") {
    return (
      <div className="app">
        <header className="hero">
          <p className="eyebrow">Party game · voice on</p>
          <h1>Imposter Word</h1>
          <p className="tagline">
            Most players get the same secret word. One is the <strong>imposter</strong>.
            Talk for <strong>1 minute each</strong>, then vote them out.
          </p>
          <div className={`pill ${connected ? "ok" : ""}`}>
            {connected ? "Online" : "Connecting…"}
          </div>
        </header>

        <section className="card">
          <label className="field">
            <span>Your name</span>
            <input
              maxLength={14}
              placeholder="e.g. Hassan"
              value={name}
              onChange={(e) => saveName(e.target.value)}
            />
          </label>

          <div className="rules">
            <div>
              <strong>3+</strong> players
            </div>
            <div>
              <strong>Mic</strong> open for all
            </div>
            <div>
              <strong>1 min</strong> each
            </div>
          </div>

          <h3 className="section-title">Host a room</h3>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${category === c.id ? "on" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Seconds per person</span>
            <select
              value={speakSeconds}
              onChange={(e) => setSpeakSeconds(Number(e.target.value))}
            >
              {[30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n}s {n === 60 ? "(default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={busy} onClick={createRoom}>
            Create room & enable mic
          </button>

          <div className="or">or join</div>

          <label className="field">
            <span>Room code</span>
            <input
              className="code"
              maxLength={4}
              placeholder="ABCD"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
            />
          </label>
          <button className="btn ghost" disabled={busy} onClick={joinRoom}>
            Join room & enable mic
          </button>
          {error && <p className="msg">{error}</p>}
        </section>

        <footer className="foot">
          Same Wi‑Fi works best for voice. Allow microphone when the browser asks.
        </footer>
      </div>
    );
  }

  /* —— LOBBY —— */
  if (screen === "lobby" && room) {
    const n = room.players?.filter((p) => p.connected).length || 0;
    const ready = n >= (room.minPlayers || 3);
    return (
      <div className="app">
        <header className="bar">
          <div>
            <h2>Lobby</h2>
            <p className="muted">
              {n}/{room.minPlayers || 3}+ players · {room.speakSeconds || 60}s turns
            </p>
          </div>
          <div className="code-big">{room.code}</div>
        </header>

        {isHost && (
          <section className="card soft">
            <p className="muted center">Friends open this link or enter the code</p>
            <p className="link mono">{joinUrls[0] || "Use room code on same server"}</p>
            <button type="button" className="btn ghost sm" onClick={copyLink}>
              Copy join link
            </button>
          </section>
        )}

        <section className="card">
          <h3>Players ({n})</h3>
          <ul className="plist">
            {(room.players || []).map((p) => (
              <li key={p.id} className={!p.connected ? "off" : ""}>
                <span className="dot" style={{ background: p.color }} />
                <span>
                  {p.name}
                  {p.isHost && <em className="tag">HOST</em>}
                  {p.id === meId && <em className="tag you">YOU</em>}
                </span>
              </li>
            ))}
          </ul>

          <MicBar micOn={micOn} muted={muted} onToggle={toggleMute} onEnable={enableMic} />

          {isHost ? (
            <button className="btn primary" disabled={busy || !ready} onClick={startGame}>
              {ready ? "Start round" : `Waiting… need ${room.minPlayers || 3}`}
            </button>
          ) : (
            <p className="muted center">Waiting for host to start…</p>
          )}
          {error && <p className="msg">{error}</p>}
        </section>
      </div>
    );
  }

  /* —— REVEAL —— */
  if (screen === "reveal" && room) {
    const imp = room.myRole === "imposter";
    return (
      <div className="app">
        <section className={`card reveal ${imp ? "imp" : "civ"}`}>
          <p className="eyebrow">{imp ? "Shh…" : "Memorize this"}</p>
          <h1 className="role">{imp ? "You are the IMPOSTER" : "You are a civilian"}</h1>
          {!imp && <p className="word">{room.secretWord}</p>}
          {imp && (
            <p className="hint">
              You don’t get the word. Listen carefully.
              <br />
              Category hint: <strong>{room.imposterHint || "Mixed"}</strong>
            </p>
          )}
          <p className="muted">Discussion starts in a few seconds…</p>
        </section>
        <MicBar micOn={micOn} muted={muted} onToggle={toggleMute} onEnable={enableMic} />
      </div>
    );
  }

  /* —— DISCUSSION —— */
  if (screen === "discussion" && room) {
    return (
      <div className="app">
        <header className="bar">
          <div>
            <h2>Discussion</h2>
            <p className="muted">Everyone can talk · spotlight = their 1 min</p>
          </div>
          <RoleChip room={room} />
        </header>

        {speaker && (
          <SpeakerRing
            secondsLeft={secondsLeft}
            total={totalSpeak}
            name={speaker.name}
            color={speaker.color}
            isMe={speaker.id === meId}
          />
        )}

        <section className="card">
          <h3>Turn order</h3>
          <ul className="turns">
            {(room.turnOrder || []).map((id) => {
              const p = room.players.find((x) => x.id === id);
              if (!p) return null;
              const active = id === room.currentSpeakerId;
              const done = p.spoken && !active;
              return (
                <li key={id} className={active ? "active" : done ? "done" : ""}>
                  <span className="dot" style={{ background: p.color }} />
                  {p.name}
                  {active && <span className="live">LIVE</span>}
                  {done && <span className="check">✓</span>}
                </li>
              );
            })}
          </ul>
          {isHost && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => socket.emit("host:skip-turn", {})}
            >
              Skip turn (host)
            </button>
          )}
        </section>

        <MicBar micOn={micOn} muted={muted} onToggle={toggleMute} onEnable={enableMic} />
        <p className="tip">
          Tip: ask vague questions. Imposter doesn’t know the word — don’t say it out loud
          if you’re a civilian!
        </p>
      </div>
    );
  }

  /* —— VOTE —— */
  if (screen === "vote" && room) {
    return (
      <div className="app">
        <header className="hero compact">
          <h1>Vote</h1>
          <p className="tagline">Who is the imposter?</p>
        </header>
        <section className="card">
          <div className="vote-grid">
            {(room.players || [])
              .filter((p) => p.connected && p.id !== meId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`vote-btn ${room.myVote === p.id ? "picked" : ""}`}
                  onClick={() => castVote(p.id)}
                  style={{ borderColor: room.myVote === p.id ? p.color : undefined }}
                >
                  <span className="dot lg" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
          </div>
          {room.myVote && <p className="muted center">Vote locked. Waiting for others…</p>}
        </section>
        <MicBar micOn={micOn} muted={muted} onToggle={toggleMute} onEnable={enableMic} />
      </div>
    );
  }

  /* —— RESULTS —— */
  if (screen === "results" && room) {
    const imposters = (room.players || []).filter((p) =>
      (room.imposterIds || []).includes(p.id)
    );
    return (
      <div className="app">
        <header className="hero compact">
          <h1>{room.civiliansWin ? "Civilians win!" : "Imposter escapes!"}</h1>
          <p className="tagline">
            The word was <strong className="word-inline">{room.secretWord}</strong>
          </p>
        </header>
        <section className="card">
          <h3>Imposter{imposters.length > 1 ? "s" : ""}</h3>
          <ul className="plist">
            {imposters.map((p) => (
              <li key={p.id}>
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </li>
            ))}
          </ul>
          {isHost ? (
            <div className="btn-row">
              <button className="btn primary" onClick={startGame}>
                Play again
              </button>
              <button
                className="btn ghost"
                onClick={() => socket.emit("host:lobby", {})}
              >
                Lobby
              </button>
            </div>
          ) : (
            <p className="muted center">Waiting for host…</p>
          )}
        </section>
        <MicBar micOn={micOn} muted={muted} onToggle={toggleMute} onEnable={enableMic} />
      </div>
    );
  }

  return (
    <div className="app">
      <p className="muted center">Loading…</p>
    </div>
  );
}

function RoleChip({ room }) {
  if (!room?.myRole) return null;
  if (room.myRole === "imposter") {
    return <span className="role-chip imp">Imposter</span>;
  }
  return (
    <span className="role-chip civ">
      Word: <strong>{room.secretWord}</strong>
    </span>
  );
}

function MicBar({ micOn, muted, onToggle, onEnable }) {
  return (
    <div className="mic-bar">
      {!micOn ? (
        <button type="button" className="btn primary sm" onClick={onEnable}>
          Enable microphone
        </button>
      ) : (
        <button
          type="button"
          className={`btn mic ${muted ? "muted" : "live"}`}
          onClick={onToggle}
        >
          {muted ? "🔇 Mic muted — tap to unmute" : "🎙️ Mic live — everyone can hear you"}
        </button>
      )}
    </div>
  );
}
