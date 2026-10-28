import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, USE_MOCKS } from '@/lib/constants';
import {
  SocialAuthCancelled,
  googleAndroidRedirectUri,
  googleClientId,
  isGoogleAuthReady,
  type GoogleSocialPayload,
} from '@/lib/social-auth';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(): { available: boolean; signIn: () => Promise<GoogleSocialPayload> } {
  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: googleClientId || 'unconfigured',
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    redirectUri: Platform.OS === 'android' ? googleAndroidRedirectUri : undefined,
    selectAccount: true,
  });

  const signIn = useCallback(async (): Promise<GoogleSocialPayload> => {
    if (USE_MOCKS) return { provider: 'google', access_token: 'mock-google-access-token' };
    const result = await promptAsync();
    if (result.type === 'success') {
      const accessToken = result.authentication?.accessToken ?? result.params.access_token;
      if (!accessToken) throw new Error('Google access token missing');
      return { provider: 'google', access_token: accessToken };
    }
    if (result.type === 'error') throw result.error ?? new Error('Google sign-in failed');
    throw new SocialAuthCancelled();
  }, [promptAsync]);

  return { available: isGoogleAuthReady && (USE_MOCKS || request != null), signIn };
}
