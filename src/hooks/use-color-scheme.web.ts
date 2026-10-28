import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppSelector } from '@/store/hooks';

const subscribe = () => () => undefined;

export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const preference = useAppSelector((s) => s.theme.preference);
  const system = useSystemColorScheme();

  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  if (!hasHydrated) return 'light';
  return system === 'dark' ? 'dark' : 'light';
}
