import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor<T>(light: T, dark: T): T {
  return useColorScheme() === 'dark' ? dark : light;
}
