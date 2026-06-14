import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://192.168.1.100:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AuthResponse {
  access_token: string;
  user: {
    id: number;
    username: string;
    email: string;
    avatar: string | null;
  };
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  isOnline: boolean;
}

export interface Room {
  id: number;
  name: string | null;
  isGroup: boolean;
  participants: User[];
  messages: Message[];
  createdAt: string;
}

export interface Message {
  id: number;
  content: string;
  senderId: number;
  roomId: number;
  isRead: boolean;
  sender: User;
  createdAt: string;
}

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
};

export const chatApi = {
  createPrivate: (targetUserId: number) =>
    api.post<Room>('/chat/private', { targetUserId }),
  createGroup: (name: string, userIds: number[]) =>
    api.post<Room>('/chat/group', { name, userIds }),
  getRooms: () => api.get<Room[]>('/chat/rooms'),
  getRoom: (id: number) => api.get<Room>(`/chat/room/${id}`),
};

export const userApi = {
  search: (q: string) => api.get<User[]>('/users/search', { params: { q } }),
};

export default api;
