import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppSelector } from '@/store/hooks';

export function useColorScheme(): 'light' | 'dark' {
  const preference = useAppSelector((s) => s.theme.preference);
  const system = useSystemColorScheme();
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return system === 'dark' ? 'dark' : 'light';
}
