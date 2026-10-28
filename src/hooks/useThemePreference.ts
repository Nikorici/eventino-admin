import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { colorScheme } from 'nativewind';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { STORAGE_KEYS } from '@/lib/constants';
import { cache } from '@/lib/storage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setThemePreference, type ThemePreference } from '@/store/slices/themeSlice';

export function useBootstrapTheme(): void {
  const dispatch = useAppDispatch();
  const preference = useAppSelector((s) => s.theme.preference);
  const effective = useColorScheme();

  useEffect(() => {
    void (async () => {
      const stored = await cache.get<ThemePreference>(STORAGE_KEYS.themePreference);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        dispatch(setThemePreference(stored));
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    colorScheme.set(Platform.OS === 'web' ? effective : preference);
  }, [preference, effective]);
}

export function useSetThemePreference(): (next: ThemePreference) => void {
  const dispatch = useAppDispatch();
  return useCallback(
    (next: ThemePreference) => {
      dispatch(setThemePreference(next));
      colorScheme.set(next);
      void cache.set(STORAGE_KEYS.themePreference, next);
    },
    [dispatch],
  );
}
