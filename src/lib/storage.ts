import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from './constants';

const isWeb = Platform.OS === 'web';

export async function getSecure(key: string): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecure(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

export async function deleteSecure(key: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    await AsyncStorage.removeItem(key);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return getSecure(STORAGE_KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return getSecure(STORAGE_KEYS.refreshToken);
}

export async function persistSession(params: {
  accessToken: string;
  refreshToken: string;
  email?: string | null;
  userId?: number | string | null;
}): Promise<void> {
  await setSecure(STORAGE_KEYS.accessToken, params.accessToken);
  await setSecure(STORAGE_KEYS.refreshToken, params.refreshToken);
  if (params.email) await setSecure(STORAGE_KEYS.userEmail, params.email);
  if (params.userId != null) await setSecure(STORAGE_KEYS.userId, String(params.userId));
}

export async function clearSession(): Promise<void> {
  await deleteSecure(STORAGE_KEYS.accessToken);
  await deleteSecure(STORAGE_KEYS.refreshToken);
  await deleteSecure(STORAGE_KEYS.userEmail);
  await deleteSecure(STORAGE_KEYS.userId);
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      return;
    }
  },
};
