import { Platform } from 'react-native';

import { colors } from './colors';

export type GlassTint = 'light' | 'dark' | 'default';
export type GlassElevation = 'low' | 'medium' | 'high';

export const blurIntensity: Record<GlassElevation, number> = {
  low: 28,
  medium: 50,
  high: 78,
};

export const supportsNativeBlur = Platform.OS === 'ios';

export function glassSurfaceClass(tint: GlassTint = 'default'): string {
  const base =
    'overflow-hidden rounded-glass border';
  const ios =
    tint === 'dark'
      ? 'bg-black/40 border-white/10'
      : 'bg-white/60 border-white/30 dark:bg-black/40 dark:border-white/10';
  const android =
    tint === 'dark'
      ? 'bg-neutral-900/85 border-white/10'
      : 'bg-white/85 border-white/40 dark:bg-neutral-900/85 dark:border-white/10';
  return `${base} ${Platform.OS === 'ios' ? ios : android}`;
}

export const glassShadow = {
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 6,
} as const;
