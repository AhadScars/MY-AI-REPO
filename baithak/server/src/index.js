const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'baithak-server' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/** @type {Map<string, { id: string, hostId: string|null, participants: Map<string, object> }>} */
const rooms = new Map();

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function getRoomSummary(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    participantCount: room.participants.size,
    participants: Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      inLobby: p.inLobby,
      audioEnabled: p.audioEnabled,
      videoEnabled: p.videoEnabled,
      isScreenSharing: p.isScreenSharing,
      joinedAt: p.joinedAt,
    })),
  };
}

function getInCallPeers(room, excludeId) {
  return Array.from(room.participants.values())
    .filter((p) => !p.inLobby && p.id !== excludeId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      audioEnabled: p.audioEnabled,
      videoEnabled: p.videoEnabled,
      isScreenSharing: p.isScreenSharing,
    }));
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('create-room', ({ name }, callback) => {
    try {
      let roomId = generateRoomCode();
      while (rooms.has(roomId)) roomId = generateRoomCode();

      const participant = {
        id: socket.id,
        name: (name || 'Host').trim().slice(0, 40) || 'Host',
        inLobby: true,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };

      const room = {
        id: roomId,
        hostId: socket.id,
        participants: new Map([[socket.id, participant]]),
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = participant.name;

      console.log(`[create-room] ${roomId} by ${participant.name}`);
      callback?.({ ok: true, roomId, participant, room: getRoomSummary(room) });
    } catch (err) {
      console.error(err);
      callback?.({ ok: false, error: 'Failed to create room' });
    }
  });

  socket.on('join-room', ({ roomId, name }, callback) => {
    try {
      const code = String(roomId || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        callback?.({ ok: false, error: 'Room not found. Check the meeting code.' });
        return;
      }
      if (room.participants.size >= 12) {
        callback?.({ ok: false, error: 'This meeting is full (max 12 participants).' });
        return;
      }

      const participant = {
        id: socket.id,
        name: (name || 'Guest').trim().slice(0, 40) || 'Guest',
        inLobby: true,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };

      room.participants.set(socket.id, participant);
      socket.join(code);
      socket.data.roomId = code;
      socket.data.name = participant.name;

      socket.to(code).emit('participant-joined-lobby', {
        participant: {
          id: participant.id,
          name: participant.name,
          inLobby: true,
          audioEnabled: true,
          videoEnabled: true,
          isScreenSharing: false,
        },
        room: getRoomSummary(room),
      });

      console.log(`[join-room] ${participant.name} -> ${code}`);
      callback?.({ ok: true, roomId: code, participant, room: getRoomSummary(room) });
    } catch (err) {
      console.error(err);
      callback?.({ ok: false, error: 'Failed to join room' });
    }
  });

  socket.on('enter-meeting', ({ audioEnabled, videoEnabled }, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !room.participants.has(socket.id)) {
      callback?.({ ok: false, error: 'Not in a room' });
      return;
    }

    const participant = room.participants.get(socket.id);
    participant.inLobby = false;
    participant.audioEnabled = audioEnabled !== false;
    participant.videoEnabled = videoEnabled !== false;

    const peers = getInCallPeers(room, socket.id);

    socket.to(roomId).emit('participant-entered', {
      participant: {
        id: participant.id,
        name: participant.name,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        isScreenSharing: false,
      },
      room: getRoomSummary(room),
    });

    console.log(`[enter-meeting] ${participant.name} in ${roomId}`);
    callback?.({ ok: true, peers, room: getRoomSummary(room) });
  });

  // WebRTC signaling: relay offers, answers, ICE candidates
  socket.on('signal', ({ to, data }) => {
    if (!to || !data) return;
    io.to(to).emit('signal', {
      from: socket.id,
      data,
      name: socket.data.name,
    });
  });

  socket.on('media-state', ({ audioEnabled, videoEnabled, isScreenSharing }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !room.participants.has(socket.id)) return;

    const p = room.participants.get(socket.id);
    if (typeof audioEnabled === 'boolean') p.audioEnabled = audioEnabled;
    if (typeof videoEnabled === 'boolean') p.videoEnabled = videoEnabled;
    if (typeof isScreenSharing === 'boolean') {
      p.isScreenSharing = isScreenSharing;
      // Screen share is a video source — keep remote tiles visible
      if (isScreenSharing) p.videoEnabled = true;
    }

    socket.to(roomId).emit('media-state', {
      participantId: socket.id,
      audioEnabled: p.audioEnabled,
      videoEnabled: p.videoEnabled,
      isScreenSharing: p.isScreenSharing,
    });
  });

  socket.on('chat-message', ({ text }, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !room.participants.has(socket.id)) {
      callback?.({ ok: false, error: 'Not in a room' });
      return;
    }
    const body = String(text || '').trim().slice(0, 2000);
    if (!body) {
      callback?.({ ok: false, error: 'Empty message' });
      return;
    }

    const participant = room.participants.get(socket.id);
    const message = {
      id: uuidv4(),
      senderId: socket.id,
      senderName: participant.name,
      text: body,
      timestamp: Date.now(),
    };

    io.to(roomId).emit('chat-message', message);
    callback?.({ ok: true, message });
  });

  socket.on('leave-room', () => {
    leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    leaveRoom(socket);
  });
});

function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(socket.id);
  room.participants.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`[room-closed] ${roomId}`);
    return;
  }

  if (room.hostId === socket.id) {
    const next = room.participants.values().next().value;
    room.hostId = next?.id || null;
  }

  socket.to(roomId).emit('participant-left', {
    participantId: socket.id,
    name: participant?.name,
    room: getRoomSummary(room),
  });
  console.log(`[leave] ${participant?.name || socket.id} left ${roomId}`);
}

server.listen(PORT, () => {
  console.log(`Baithak signaling server listening on :${PORT}`);
});
