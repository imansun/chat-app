import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem, setItem, deleteItem } from '../services/webStorage';
import { authApi, AuthResponse, User } from '../services/api';
import { ensureKeys } from '../services/e2ee';
import { registerForPushNotificationsAsync, sendPushTokenToServer } from '../services/notifications';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await getItem('token');
      const storedUser = await getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuth = async (data: AuthResponse) => {
    await setItem('token', data.access_token);
    await setItem('user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
  };

  const initE2EE = async (userId: number) => {
    try {
      await ensureKeys(userId);
    } catch {
      // E2EE setup failure is non-fatal
    }
  };

  const login = async (username: string, password: string) => {
    const { data } = await authApi.login({ username, password });
    await saveAuth(data);
    await initE2EE(data.user.id);
    registerPushToken();
  };

  const register = async (username: string, email: string, password: string) => {
    const { data } = await authApi.register({ username, email, password });
    await saveAuth(data);
    await initE2EE(data.user.id);
    registerPushToken();
  };

  const registerPushToken = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await sendPushTokenToServer(token);
      }
    } catch {}
  };

  const logout = async () => {
    await deleteItem('token');
    await deleteItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
