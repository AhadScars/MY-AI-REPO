/**
 * Mesh WebRTC voice: each client connects to every other peer.
 * Signaling goes through socket.io (voice:signal).
 */

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class VoiceMesh {
  constructor(socket, { onSpeakingChange } = {}) {
    this.socket = socket;
    this.localStream = null;
    this.peers = new Map(); // id -> { pc, audio }
    this.muted = false;
    this.enabled = false;
    this.onSpeakingChange = onSpeakingChange;
    this._bound = false;
  }

  bindSignals() {
    if (this._bound) return;
    this._bound = true;

    this.socket.on("voice:signal", async ({ from, data }) => {
      try {
        await this._handleSignal(from, data);
      } catch (e) {
        console.warn("voice signal error", e);
      }
    });

    this.socket.on("voice:peers", async ({ peers }) => {
      for (const p of peers) {
        await this.connectTo(p.id, true);
      }
    });

    this.socket.on("voice:peer-joined", async ({ id }) => {
      // Existing peers wait for the newcomer to offer, OR we offer if our id < theirs (stable)
      if (this.socket.id && id > this.socket.id) {
        await this.connectTo(id, true);
      }
    });

    this.socket.on("voice:peer-left", ({ id }) => {
      this._closePeer(id);
    });
  }

  async enable() {
    this.bindSignals();
    if (this.enabled) return true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.enabled = true;
      this.muted = false;
      this.socket.emit("voice:ready");
      return true;
    } catch (e) {
      console.error("mic denied", e);
      this.enabled = false;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.localStream) {
      for (const t of this.localStream.getAudioTracks()) {
        t.enabled = !muted;
      }
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async connectTo(peerId, isInitiator) {
    if (!this.enabled || !this.localStream) return;
    if (peerId === this.socket.id) return;
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(ICE);
    const entry = { pc, audio: null };
    this.peers.set(peerId, entry);

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit("voice:signal", {
          to: peerId,
          data: { type: "candidate", candidate: ev.candidate },
        });
      }
    };

    pc.ontrack = (ev) => {
      let audio = entry.audio;
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        audio.dataset.peer = peerId;
        document.body.appendChild(audio);
        entry.audio = audio;
      }
      audio.srcObject = ev.streams[0];
      audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        // keep for a bit; full cleanup on peer-left
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit("voice:signal", {
        to: peerId,
        data: { type: "offer", sdp: pc.localDescription },
      });
    }
  }

  async _handleSignal(from, data) {
    if (!this.enabled || !this.localStream) return;

    let entry = this.peers.get(from);
    if (!entry) {
      // Create as answerer
      await this.connectTo(from, false);
      entry = this.peers.get(from);
    }
    if (!entry) return;
    const { pc } = entry;

    if (data.type === "offer") {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit("voice:signal", {
        to: from,
        data: { type: "answer", sdp: pc.localDescription },
      });
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(data.sdp);
    } else if (data.type === "candidate" && data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch {
        /* ignore */
      }
    }
  }

  _closePeer(id) {
    const entry = this.peers.get(id);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {
      /* */
    }
    if (entry.audio) {
      entry.audio.srcObject = null;
      entry.audio.remove();
    }
    this.peers.delete(id);
  }

  destroy() {
    for (const id of [...this.peers.keys()]) this._closePeer(id);
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    this.enabled = false;
  }
}
