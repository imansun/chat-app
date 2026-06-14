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
  lastMessage: Message | null;
  createdAt: string;
}

export interface Message {
  id: number;
  content: string;
  type: 'text' | 'image' | 'voice';
  senderId: number;
  roomId: number;
  isRead: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  isEncrypted: boolean;
  sender: User;
  createdAt: string;
}

export interface StoryType {
  id: number;
  url: string;
  user: User;
  userId: number;
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
  getRoomMessages: (id: number, limit = 50, offset = 0) =>
    api.get<Message[]>(`/chat/room/${id}/messages`, { params: { limit, offset } }),
  editMessage: (id: number, content: string) =>
    api.patch<Message>(`/chat/messages/${id}`, { content }),
  deleteMessage: (id: number) =>
    api.delete(`/chat/messages/${id}`),
  uploadImage: (roomId: number, fileUri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);
    formData.append('roomId', roomId.toString());
    return api.post<Message>('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateRoomName: (id: number, name: string) =>
    api.patch<Room>(`/chat/room/${id}`, { name }),
  addMembers: (id: number, userIds: number[]) =>
    api.post<Room>(`/chat/room/${id}/members`, { userIds }),
  removeMember: (roomId: number, userId: number) =>
    api.delete<Room>(`/chat/room/${roomId}/members/${userId}`),
};

export const userApi = {
  search: (q: string) => api.get<User[]>('/users/search', { params: { q } }),
  updateProfile: (formData: FormData) =>
    api.patch<User>('/users/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const storyApi = {
  getActive: () => api.get<StoryType[]>('/stories'),
  getMine: () => api.get<StoryType[]>('/stories/mine'),
  create: (fileUri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'story.jpg',
    } as any);
    return api.post<StoryType>('/stories', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id: number) => api.delete(`/stories/${id}`),
};

export const voiceApi = {
  upload: (roomId: number, fileUri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'audio/mp4',
      name: 'voice.m4a',
    } as any);
    formData.append('roomId', roomId.toString());
    return api.post<Message>('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const callApi = {
  getHistory: () => api.get<any[]>('/calls/history'),
  getMissed: () => api.get<any[]>('/calls/missed'),
};

export const keyApi = {
  upload: (publicKey: string) => api.post('/keys', { publicKey }),
  get: (userId: number) => api.get<string>(`/keys/${userId}`),
  has: () => api.get<boolean>('/keys/me/has'),
};

export default api;
