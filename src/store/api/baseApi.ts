import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import { API_URL, AUTH_SCHEME, STORAGE_KEYS, USE_MOCKS, endpoints } from '@/lib/constants';
import i18n from '@/lib/i18n';
import { clearSession, getAccessToken, getRefreshToken, setSecure } from '@/lib/storage';
import type { MockMethod } from '@/mocks/mock';
import { showToast } from '@/store/slices/uiSlice';

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

interface RefreshOutcome {
  token: string | null;
  expired: boolean;
  reason?: string;
}

let refreshPromise: Promise<RefreshOutcome> | null = null;

async function requestNewAccessToken(): Promise<RefreshOutcome> {
  const refresh = await getRefreshToken();
  if (!refresh) return { token: null, expired: true };
  try {
    const response = await fetch(`${API_URL}${endpoints.tokenRefresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    const data = (await response.json().catch(() => ({}))) as { access?: string; access_token?: string; detail?: string };
    if (!response.ok) {
      return { token: null, expired: response.status === 400 || response.status === 401, reason: data.detail };
    }
    const newToken = data.access ?? data.access_token ?? null;
    if (newToken) await setSecure(STORAGE_KEYS.accessToken, newToken);
    return { token: newToken, expired: false };
  } catch {
    return { token: null, expired: false };
  }
}

function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (USE_MOCKS) return getAccessToken();
  return (await refreshSession()).token;
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
  const sentToken = await getAccessToken();
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401 || !sentToken) return result;

  const storedToken = await getAccessToken();
  const outcome: RefreshOutcome =
    storedToken && storedToken !== sentToken ? { token: storedToken, expired: false } : await refreshSession();
  if (outcome.token) return rawBaseQuery(args, api, extraOptions);

  if (outcome.expired) {
    await clearSession();
    api.dispatch({ type: 'auth/loggedOut' });
    api.dispatch(
      showToast({ type: 'error', message: outcome.reason ?? i18n.t('Your session has expired. Please log in again.') }),
    );
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
