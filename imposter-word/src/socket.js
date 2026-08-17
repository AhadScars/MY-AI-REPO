import { io } from "socket.io-client";

export const socket = io(undefined, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

export function onceConnected() {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => socket.once("connect", resolve));
}
