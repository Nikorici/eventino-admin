import { exchangeCodeAsync, type AuthRequest } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';

import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, USE_MOCKS } from '@/lib/constants';
import {
  SocialAuthCancelled,
  googleClientId,
  googleNativeRedirectUri,
  isGoogleAuthReady,
  type GoogleSocialPayload,
} from '@/lib/social-auth';

WebBrowser.maybeCompleteAuthSession();

async function exchangeGoogleCode(request: AuthRequest, code: string): Promise<string> {
  const tokens = await exchangeCodeAsync(
    {
      clientId: request.clientId,
      code,
      redirectUri: request.redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    Google.discovery,
  );
  return tokens.accessToken;
}

export function useGoogleSignIn(): { available: boolean; signIn: () => Promise<GoogleSocialPayload> } {
  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: googleClientId || 'unconfigured',
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    redirectUri: googleNativeRedirectUri,
    selectAccount: true,
    shouldAutoExchangeCode: false,
  });

  const signIn = useCallback(async (): Promise<GoogleSocialPayload> => {
    if (USE_MOCKS) return { provider: 'google', access_token: 'mock-google-access-token' };
    const result = await promptAsync();
    if (result.type === 'success') {
      const code = result.params.code;
      const accessToken =
        result.authentication?.accessToken ??
        result.params.access_token ??
        (code && request ? await exchangeGoogleCode(request, code) : undefined);
      if (!accessToken) throw new Error('Google access token missing');
      return { provider: 'google', access_token: accessToken };
    }
    if (result.type === 'error') throw result.error ?? new Error('Google sign-in failed');
    throw new SocialAuthCancelled();
  }, [promptAsync, request]);

  return { available: isGoogleAuthReady && (USE_MOCKS || request != null), signIn };
}
