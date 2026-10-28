import { useCallback, useEffect } from 'react';

import {
  useFetchCurrentUserMutation,
  usePasswordLoginMutation,
  useSocialLoginMutation,
  useVerifyOtpMutation,
} from '@/store/api/authApi';
import { useLazyGetUserQuery } from '@/store/api/usersApi';
import { baseApi } from '@/store/api/baseApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loggedOut, setBootstrapping, setUser } from '@/store/slices/authSlice';
import { STORAGE_KEYS } from '@/lib/constants';
import type { SocialLoginPayload } from '@/lib/social-auth';
import { cache, clearSession, getAccessToken, getSecure, persistSession, setSecure } from '@/lib/storage';
import type { User } from '@/types/api';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isBootstrapping } = useAppSelector((s) => s.auth);

  const [passwordLogin] = usePasswordLoginMutation();
  const [verifyOtp] = useVerifyOtpMutation();
  const [socialLogin] = useSocialLoginMutation();
  const [fetchCurrentUser] = useFetchCurrentUserMutation();

  const finishSession = useCallback(
    async (access: string, refresh: string, email: string, userFromResponse?: User | null) => {
      await persistSession({ accessToken: access, refreshToken: refresh, email });
      let resolvedUser = userFromResponse ?? null;
      if (!resolvedUser && email) {
        try {
          resolvedUser = await fetchCurrentUser({ email }).unwrap();
        } catch {
          resolvedUser = null;
        }
      }
      if (resolvedUser?.id != null) await setSecure(STORAGE_KEYS.userId, String(resolvedUser.id));
      if (resolvedUser) await cache.set(STORAGE_KEYS.cachedUser, resolvedUser);
      dispatch(setUser(resolvedUser));
      return resolvedUser;
    },
    [dispatch, fetchCurrentUser],
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await passwordLogin({ email, password }).unwrap();
        if (res.access && res.refresh) {
          await finishSession(res.access, res.refresh, email);
          return { ok: true };
        }
        return { ok: false, error: res.detail };
      } catch (error) {
        return { ok: false, error: extractError(error) };
      }
    },
    [passwordLogin, finishSession],
  );

  const loginWithOtp = useCallback(
    async (
      email: string,
      otpCode: string,
      names?: { first_name: string; last_name: string },
    ): Promise<AuthResult & { isNewAccount?: boolean }> => {
      try {
        const res = await verifyOtp({ email, otp_code: otpCode, ...names }).unwrap();
        const payload = res.data ?? res;
        const access = payload.access;
        const refresh = payload.refresh;
        if (access && refresh) {
          await finishSession(access, refresh, email, payload.user ?? null);
          return { ok: true, isNewAccount: payload.is_new_account };
        }
        return { ok: false, error: payload.message ?? res.message };
      } catch (error) {
        return { ok: false, error: extractError(error) };
      }
    },
    [verifyOtp, finishSession],
  );

  const loginWithSocial = useCallback(
    async (payload: SocialLoginPayload): Promise<AuthResult & { appleEmailRequired?: boolean }> => {
      try {
        const res = await socialLogin(payload).unwrap();
        const access = res.access_token ?? res.access;
        const refresh = res.refresh_token ?? res.refresh;
        const email = res.user?.email ?? (payload.provider === 'apple.com' ? payload.user.email ?? '' : '');
        if (access && refresh) {
          await finishSession(access, refresh, email ?? '', res.user ?? null);
          return { ok: true };
        }
        return { ok: false };
      } catch (error) {
        const code = extractCode(error);
        if (code === 'apple_email_required') return { ok: false, appleEmailRequired: true };
        return { ok: false, error: extractError(error) };
      }
    },
    [socialLogin, finishSession],
  );

  const logout = useCallback(async () => {
    await clearSession();
    await cache.remove(STORAGE_KEYS.cachedUser);
    await cache.remove(STORAGE_KEYS.selectedEvent);
    dispatch(loggedOut());
    dispatch(baseApi.util.resetApiState());
  }, [dispatch]);

  return { user, isAuthenticated, isBootstrapping, loginWithPassword, loginWithOtp, loginWithSocial, logout };
}

export function useApplySwitchedSession() {
  const dispatch = useAppDispatch();
  const [getUser] = useLazyGetUserQuery();

  return useCallback(
    async (session: { access: string; refresh: string; user: User }) => {
      await persistSession({
        accessToken: session.access,
        refreshToken: session.refresh,
        email: session.user.email,
        userId: session.user.id,
      });
      await cache.set(STORAGE_KEYS.cachedUser, session.user);
      dispatch(setUser(session.user));
      dispatch(baseApi.util.resetApiState());
      try {
        const fetched = await getUser(session.user.id).unwrap();
        if (fetched?.id != null) {
          await cache.set(STORAGE_KEYS.cachedUser, fetched);
          dispatch(setUser(fetched));
        }
      } catch {
        dispatch(setUser(session.user));
      }
    },
    [dispatch, getUser],
  );
}

export function useBootstrapAuth() {
  const dispatch = useAppDispatch();
  const [getUser] = useLazyGetUserQuery();
  const [fetchCurrentUser] = useFetchCurrentUserMutation();

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (active) dispatch(setBootstrapping(false));
        return;
      }

      const cachedUser = await cache.get<User>(STORAGE_KEYS.cachedUser);
      if (cachedUser && active) {
        dispatch(setUser(cachedUser));
        dispatch(setBootstrapping(false));
      }

      const userId = await getSecure(STORAGE_KEYS.userId);
      const email = await getSecure(STORAGE_KEYS.userEmail);
      try {
        let resolved: User | null = null;
        if (userId) resolved = await getUser(userId).unwrap();
        else if (email) resolved = await fetchCurrentUser({ email }).unwrap();
        if (active && resolved) {
          await cache.set(STORAGE_KEYS.cachedUser, resolved);
          dispatch(setUser(resolved));
        } else if (active && !cachedUser) {
          dispatch(setUser(null));
        }
      } catch {
        if (active && !cachedUser) dispatch(setUser(null));
      } finally {
        if (active && !cachedUser) dispatch(setBootstrapping(false));
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch, getUser, fetchCurrentUser]);
}

function extractError(error: unknown): string | undefined {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data) {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === 'string') return record.detail;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.error === 'string') return record.error;
      const firstKey = Object.keys(record)[0];
      const value = firstKey ? record[firstKey] : undefined;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return undefined;
}

function extractCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { code?: string } }).data;
    return data?.code;
  }
  return undefined;
}
