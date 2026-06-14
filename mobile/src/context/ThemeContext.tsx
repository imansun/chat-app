import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getItem, setItem } from '../services/webStorage';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  primaryDark: string;
  text: string;
  textSecondary: string;
  textInverse: string;
  bubbleMine: string;
  bubbleOther: string;
  border: string;
  inputBg: string;
  headerBg: string;
  statusBar: string;
  danger: string;
  online: string;
}

export const lightColors: ThemeColors = {
  background: '#ECE5DD',
  surface: '#fff',
  primary: '#075E54',
  primaryDark: '#054d44',
  text: '#333',
  textSecondary: '#666',
  textInverse: '#fff',
  bubbleMine: '#DCF8C6',
  bubbleOther: '#fff',
  border: '#ddd',
  inputBg: '#f0f0f0',
  headerBg: '#075E54',
  statusBar: '#075E54',
  danger: '#ff4444',
  online: '#4CAF50',
};

export const darkColors: ThemeColors = {
  background: '#111b21',
  surface: '#1f2c33',
  primary: '#00a884',
  primaryDark: '#008f6b',
  text: '#e9edef',
  textSecondary: '#8696a0',
  textInverse: '#111b21',
  bubbleMine: '#005c4b',
  bubbleOther: '#1f2c33',
  border: '#313d45',
  inputBg: '#2a3942',
  headerBg: '#1f2c33',
  statusBar: '#0b141a',
  danger: '#ef5350',
  online: '#00a884',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    getItem('theme').then((val) => {
      if (val === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await setItem('theme', next ? 'dark' : 'light');
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
