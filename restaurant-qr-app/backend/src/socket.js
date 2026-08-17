let io = null;

export function initSocket(serverIo) {
  io = serverIo;
  io.on('connection', (socket) => {
    socket.on('join:restaurant', (restaurantId) => {
      if (restaurantId) socket.join(`restaurant:${restaurantId}`);
    });
    socket.on('join:session', (sessionId) => {
      if (sessionId) socket.join(`session:${sessionId}`);
    });
  });
}

export function emitToRestaurant(restaurantId, event, payload) {
  if (io) io.to(`restaurant:${restaurantId}`).emit(event, payload);
}

export function emitToSession(sessionId, event, payload) {
  if (io) io.to(`session:${sessionId}`).emit(event, payload);
}
