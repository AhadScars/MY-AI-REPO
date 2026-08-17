import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io('/', { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function joinRestaurant(restaurantId) {
  const s = getSocket();
  s.emit('join:restaurant', restaurantId);
  return s;
}

export function joinSession(sessionId) {
  const s = getSocket();
  s.emit('join:session', sessionId);
  return s;
}
