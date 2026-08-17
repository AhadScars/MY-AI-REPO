# Baithak

**Baithak** (بیٹھک — a gathering place) is a modern Google Meet–style video conference app.

- 1:1 and small group (1:many) video calls via **WebRTC**
- Real-time **chat** and **screen share**
- **Lobby** with camera/mic preview before joining
- Responsive UI: video tiles with **name + mute indicators**, control bar, chat panel

## Stack

| Layer | Tech |
|--------|------|
| Client | React 19, TypeScript, Vite, Tailwind CSS v4, Socket.io-client |
| Server | Node.js, Express, Socket.io (signaling + chat + room state) |
| Media | WebRTC mesh (STUN), `getUserMedia` / `getDisplayMedia` |

## Quick start

```bash
# From the baithak folder
npm install
npm install --prefix server
npm install --prefix client

# Run signaling server + Vite client together
npm install concurrently --save-dev   # if not already
npm run dev
```

- App: [http://localhost:5173](http://localhost:5173)
- Signaling: [http://localhost:3001](http://localhost:3001)

### Separate terminals

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

## How to use

1. Open the app and enter your name.
2. **New meeting** → create a room → share the 6-character code.
3. In the **lobby**, check camera/mic, then **Join now**.
4. Others **Join with code**, wait in lobby, then join the call.
5. Use the control bar to mute, stop video, share screen, open chat, or leave.

> **Tip:** Test with two browser windows (or normal + incognito). Camera access is required for video; the app falls back to audio-only if the camera is blocked.

## Features

| Feature | Details |
|---------|---------|
| Lobby | Preview stream, mute toggles, participant waiting list, copy meeting code |
| Video tiles | Adaptive grid, participant name, mute badge, screen-share label, local mirror |
| Chat | Side panel (desktop) / bottom sheet (mobile), timestamps, unread badge |
| Screen share | Replaces outbound video track for all peers; stop from browser UI or control bar |
| Rooms | Create / join by code, max 12 participants, host reassignment on leave |

## Architecture

```
Browser A  ←—WebRTC media (mesh)—→  Browser B
    │ Socket.io (offer/answer/ICE, chat, presence) │
    └──────────────► Signaling server ◄────────────┘
```

- Signaling only (no media SFU). Best for demos and small groups.
- Production scale would add TURN servers and optionally an SFU (LiveKit, mediasoup, etc.).

## Project layout

```
baithak/
├── client/                 # React SPA
│   └── src/
│       ├── components/     # VideoTile, ControlBar, ChatPanel, ParticipantList
│       ├── hooks/          # useMedia, useWebRTC
│       ├── pages/          # Home, Lobby, Meeting
│       └── lib/socket.ts
└── server/
    └── src/index.js        # Rooms + WebRTC signal relay + chat
```

## Environment

Optional client env (`client/.env`):

```
VITE_SIGNALING_URL=http://localhost:3001
```

Server:

```
PORT=3001
```

## License

MIT
