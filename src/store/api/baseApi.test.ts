import type { BaseQueryApi } from '@reduxjs/toolkit/query';

import { baseQueryWithReauth } from './baseApi';

const mockStore = new Map<string, string>();

jest.mock('@reduxjs/toolkit/query/react', () => jest.requireActual('@reduxjs/toolkit/query'));

jest.mock('@/lib/storage', () => ({
  getAccessToken: async () => mockStore.get('accessToken') ?? null,
  getRefreshToken: async () => mockStore.get('refreshToken') ?? null,
  setSecure: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  clearSession: async () => {
    mockStore.clear();
  },
}));

function queryApi(dispatch: jest.Mock): BaseQueryApi {
  return {
    signal: new AbortController().signal,
    abort: jest.fn(),
    dispatch,
    getState: () => ({}),
    extra: undefined,
    endpoint: 'test',
    type: 'query',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockServer(refreshStatus: number) {
  const refreshCalls: string[] = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    if (request.url.endsWith('/api/token/refresh/')) {
      refreshCalls.push(request.url);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return refreshStatus === 200
        ? json(200, { access: 'fresh-access' })
        : json(refreshStatus, { detail: 'Token is invalid or expired', code: 'token_not_valid' });
    }
    return request.headers.get('Authorization') === 'ThemydaAPI fresh-access'
      ? json(200, { ok: true })
      : json(401, { detail: 'Given token not valid for any token type' });
  });
  return refreshCalls;
}

describe('baseQueryWithReauth', () => {
  beforeEach(() => {
    mockStore.clear();
    mockStore.set('accessToken', 'stale-access');
    mockStore.set('refreshToken', 'valid-refresh');
  });

  it('refreshes once for concurrent 401s and retries every request with the new token', async () => {
    const refreshCalls = mockServer(200);
    const dispatch = jest.fn();
    const results = await Promise.all(
      ['/api/v1/users/852/', '/api/v1/linked-accounts/', '/api/v1/events/480/'].map((url) =>
        baseQueryWithReauth(url, queryApi(dispatch), {}),
      ),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(results.map((result) => result.data)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(mockStore.get('accessToken')).toBe('fresh-access');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('clears the session and logs out when the refresh token is rejected', async () => {
    mockServer(401);
    const dispatch = jest.fn();
    const result = await baseQueryWithReauth('/api/v1/users/852/', queryApi(dispatch), {});
    expect(result.error?.status).toBe(401);
    expect(mockStore.size).toBe(0);
    expect(dispatch).toHaveBeenCalledWith({ type: 'auth/loggedOut' });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ message: 'Token is invalid or expired' }) }),
    );
  });

  it('keeps the session when the refresh fails for a server error', async () => {
    mockServer(503);
    const dispatch = jest.fn();
    await baseQueryWithReauth('/api/v1/users/852/', queryApi(dispatch), {});
    expect(mockStore.get('refreshToken')).toBe('valid-refresh');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('never refreshes for a request sent without a session', async () => {
    mockStore.clear();
    const refreshCalls = mockServer(200);
    const dispatch = jest.fn();
    const result = await baseQueryWithReauth(
      { url: '/api/login/', method: 'POST', body: { email: 'a@b.c', password: 'x' } },
      queryApi(dispatch),
      {},
    );
    expect(result.error?.status).toBe(401);
    expect(refreshCalls).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
