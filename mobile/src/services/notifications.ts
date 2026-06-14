import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getItem } from './webStorage';
import { API_URL } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (permissions.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#075E54',
    });
  }

  return token;
}

export async function sendPushTokenToServer(token: string): Promise<void> {
  const authToken = await getItem('token');
  if (!authToken) return;

  try {
    await fetch(`${API_URL}/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: 'expo' }),
    });
  } catch {
    // silent fail
  }
}

export async function unregisterPushToken(token: string): Promise<void> {
  const authToken = await getItem('token');
  if (!authToken) return;

  try {
    await fetch(`${API_URL}/notifications/unregister`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // silent fail
  }
}
