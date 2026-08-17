# Imposter Word

Party game for **3+ players**. Most people get the same secret word; **one is the imposter**. Everyone talks over **live mic** (WebRTC). Each player gets their **own 1-minute spotlight timer**, then you **vote**.

Light, warm UI.

## How to play

1. Host creates a room (mic permission required).
2. Friends join with the **4-letter code** or join link (same Wi‑Fi / same server).
3. Need **at least 3** players → host starts.
4. **Reveal (8s):** civilians see the word; imposter only sees category.
5. **Discussion:** voice is open for everyone. One player at a time has a **60s** ring timer (order is random). Host can skip a turn.
6. **Vote** who the imposter is.
7. Results → play again.

## Run

```bash
cd imposter-word
npm install
npm run preview
```

Open the printed URL (e.g. `http://192.168.x.x:3850`) on every phone.

### Dev

```bash
npm run dev
```

- Client: http://localhost:5174  
- Server: http://localhost:3850  

## Notes

- **Mic:** browsers need HTTPS or `localhost` for `getUserMedia`. On LAN IPs, some mobile browsers still allow mic on HTTP for local network; if not, use a tunnel (ngrok) or host with HTTPS.
- **Voice:** mesh WebRTC + STUN. Works best on the same Wi‑Fi.
- **Roles:** 1 imposter (2 if 7+ players). Word bank is offline — no API key.

## Scripts

| Command | |
|---------|--|
| `npm run preview` | Build + serve (party mode) |
| `npm run dev` | Hot reload |
| `npm start` | Serve existing `dist/` |

## Stack

Express · Socket.io · React · WebRTC
