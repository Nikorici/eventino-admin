import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import { API_URL, AUTH_SCHEME, STORAGE_KEYS, USE_MOCKS, endpoints } from '@/lib/constants';
import { clearSession, getAccessToken, getRefreshToken, setSecure } from '@/lib/storage';
import type { MockMethod } from '@/mocks/mock';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: async (headers, { arg }) => {
    const url = typeof arg === 'string' ? arg : arg.url;
    if (!headers.has('Authorization') && !/^https?:\/\//.test(url)) {
      const token = await getAccessToken();
      if (token) headers.set('Authorization', `${AUTH_SCHEME} ${token}`);
    }
    return headers;
  },
});

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (USE_MOCKS) return getAccessToken();
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = await getRefreshToken();
      if (!refresh) return null;
      try {
        const response = await fetch(`${API_URL}${endpoints.tokenRefresh}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { access?: string; access_token?: string };
        const newToken = data.access ?? data.access_token ?? null;
        if (newToken) await setSecure(STORAGE_KEYS.accessToken, newToken);
        return newToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function toMockMethod(method: string | undefined): MockMethod {
  const upper = (method ?? 'GET').toUpperCase();
  if (upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE') return upper;
  return 'GET';
}

function readQuery(search: string, params: unknown): Record<string, string> {
  const query: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    query[key] = value;
  });
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) query[key] = String(value);
    });
  }
  return query;
}

const mockBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args) => {
  const { resolveMock } = await import('@/mocks');
  const request = typeof args === 'string' ? { url: args } : args;
  const [path, search = ''] = request.url.split('?');
  return resolveMock({
    method: toMockMethod(request.method),
    path,
    query: readQuery(search, request.params),
    body: request.body,
    token: await getAccessToken(),
  });
};

const networkBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      await clearSession();
      api.dispatch({ type: 'auth/loggedOut' });
    }
  }

  return result;
};

export const baseQueryWithReauth = USE_MOCKS ? mockBaseQuery : networkBaseQuery;

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  keepUnusedDataFor: 120,
  refetchOnReconnect: true,
  tagTypes: ['Event', 'EventDetail', 'Featured', 'HomeFeed', 'Category', 'Ticket', 'Order', 'User', 'Notifications', 'Buyers', 'FreeTickets'],
  endpoints: () => ({}),
});
