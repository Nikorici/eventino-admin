import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, USE_MOCKS } from './constants';

export interface GoogleSocialPayload {
  provider: 'google';
  access_token: string;
}

export interface AppleSocialPayload {
  provider: 'apple.com';
  identity_token: string;
  platform: 'ios';
  user: { email: string | null; name: { firstName: string; lastName: string } };
}

export type SocialLoginPayload = GoogleSocialPayload | AppleSocialPayload;

export class SocialAuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialAuthCancelled';
  }
}

export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const googleClientId =
  Platform.select({
    ios: GOOGLE_IOS_CLIENT_ID,
    android: GOOGLE_ANDROID_CLIENT_ID,
    default: GOOGLE_WEB_CLIENT_ID,
  }) ?? '';

export const googleAndroidRedirectUri = GOOGLE_ANDROID_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauthredirect`
  : undefined;

export const isGoogleAuthReady = USE_MOCKS || (googleClientId.length > 0 && (Platform.OS === 'web' || !inExpoGo));

export async function signInWithApple(): Promise<AppleSocialPayload> {
  if (USE_MOCKS) {
    return {
      provider: 'apple.com',
      identity_token: 'mock-apple-identity-token',
      platform: 'ios',
      user: { email: null, name: { firstName: '', lastName: '' } },
    };
  }
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple identity token missing');
    }
    return {
      provider: 'apple.com',
      identity_token: credential.identityToken,
      platform: 'ios',
      user: {
        email: credential.email ?? null,
        name: {
          firstName: credential.fullName?.givenName ?? '',
          lastName: credential.fullName?.familyName ?? '',
        },
      },
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SocialAuthCancelled();
    }
    throw error;
  }
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
