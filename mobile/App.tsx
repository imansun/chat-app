import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CallProvider } from './src/context/CallContext';
import Navigation, { navigationRef } from './src/navigation/Navigation';
import { chatApi } from './src/services/api';
import { getItem } from './src/services/webStorage';

function AppContent() {
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.roomId) {
        try {
          const { data: room } = await chatApi.getRoom(Number(data.roomId));
          navigationRef.current?.navigate('Chat', { room });
        } catch {
          navigationRef.current?.navigate('ChatList');
        }
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Navigation />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <AppContent />
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
