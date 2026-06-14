import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

let SecureStore: any;
if (!isWeb) {
  SecureStore = require('expo-secure-store');
}

const webStore = new Map<string, string>();

const webGetItem = async (key: string): Promise<string | null> => {
  try {
    return localStorage.getItem(key);
  } catch {
    return webStore.get(key) || null;
  }
};

const webSetItem = async (key: string, value: string): Promise<void> => {
  try {
    localStorage.setItem(key, value);
  } catch {
    webStore.set(key, value);
  }
};

const webDeleteItem = async (key: string): Promise<void> => {
  try {
    localStorage.removeItem(key);
  } catch {
    webStore.delete(key);
  }
};

export const getItem = isWeb ? webGetItem : SecureStore.getItemAsync;
export const setItem = isWeb ? webSetItem : SecureStore.setItemAsync;
export const deleteItem = isWeb ? webDeleteItem : SecureStore.deleteItemAsync;

export default { getItem, setItem, deleteItem };
