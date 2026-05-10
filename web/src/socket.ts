/**
 * Socket.io client singleton for real-time Codex events.
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/ws', {
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
}
