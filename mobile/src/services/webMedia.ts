import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export async function requestMicrophonePermission(): Promise<boolean> {
  if (!isWeb) {
    const { Audio } = require('expo-av');
    const perm = await Audio.requestPermissionsAsync();
    return perm.granted;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function isWebPlatform(): boolean {
  return isWeb;
}
