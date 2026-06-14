import { io, Socket } from 'socket.io-client';
import { getItem } from './webStorage';

const SOCKET_URL = 'http://192.168.1.100:3000';

let socket: Socket | null = null;
let callSocket: Socket | null = null;

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await getItem('token');

  socket = io(`${SOCKET_URL}/chat`, {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
};

export const connectCallSocket = async (): Promise<Socket> => {
  if (callSocket?.connected) return callSocket;

  const token = await getItem('token');

  callSocket = io(`${SOCKET_URL}/call`, {
    auth: { token },
    transports: ['websocket'],
  });

  return callSocket;
};

export const getSocket = (): Socket | null => socket;
export const getCallSocket = (): Socket | null => callSocket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const disconnectCallSocket = () => {
  if (callSocket) {
    callSocket.disconnect();
    callSocket = null;
  }
};
