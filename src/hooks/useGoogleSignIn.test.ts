import { act, renderHook } from '@testing-library/react-native';

import { useGoogleSignIn } from './useGoogleSignIn';

const mockPromptAsync = jest.fn();
const mockExchangeCodeAsync = jest.fn();
const mockUseAuthRequest = jest.fn();
const mockRequest = {
  clientId: 'ios-client.apps.googleusercontent.com',
  redirectUri: 'com.googleusercontent.apps.ios-client:/oauthredirect',
  codeVerifier: 'verifier-123',
};

jest.mock('expo-auth-session', () => ({
  exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  discovery: { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
  useAuthRequest: (...args: unknown[]) => mockUseAuthRequest(...args),
}));

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

jest.mock('@/lib/constants', () => ({
  GOOGLE_ANDROID_CLIENT_ID: '',
  GOOGLE_IOS_CLIENT_ID: 'ios-client.apps.googleusercontent.com',
  GOOGLE_WEB_CLIENT_ID: '',
  USE_MOCKS: false,
}));

jest.mock('@/lib/social-auth', () => ({
  SocialAuthCancelled: class SocialAuthCancelled extends Error {},
  googleClientId: 'ios-client.apps.googleusercontent.com',
  googleNativeRedirectUri: 'com.googleusercontent.apps.ios-client:/oauthredirect',
  isGoogleAuthReady: true,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthRequest.mockReturnValue([mockRequest, null, mockPromptAsync]);
});

describe('useGoogleSignIn', () => {
  it('exchanges the authorization code for an access token itself', async () => {
    mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'auth-code' }, authentication: null });
    mockExchangeCodeAsync.mockResolvedValue({ accessToken: 'google-access-token' });
    const { result } = await renderHook(() => useGoogleSignIn());

    let payload: unknown;
    await act(async () => {
      payload = await result.current.signIn();
    });

    expect(payload).toEqual({ provider: 'google', access_token: 'google-access-token' });
    expect(mockExchangeCodeAsync).toHaveBeenCalledWith(
      {
        clientId: mockRequest.clientId,
        code: 'auth-code',
        redirectUri: mockRequest.redirectUri,
        extraParams: { code_verifier: 'verifier-123' },
      },
      { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    );
  });

  it('turns off the provider auto exchange so the single-use code is exchanged once', async () => {
    await renderHook(() => useGoogleSignIn());

    expect(mockUseAuthRequest).toHaveBeenCalledWith(expect.objectContaining({ shouldAutoExchangeCode: false }));
  });
});
