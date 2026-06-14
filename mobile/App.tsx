import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import Navigation from './src/navigation/Navigation';

function AppContent() {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'light'} />
      <Navigation />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
