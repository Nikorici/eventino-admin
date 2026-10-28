import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { cn } from '@/lib/cn';
import { blurIntensity, type GlassElevation, type GlassTint } from '@/theme/glass';

export interface GlassSurfaceProps {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  tint?: GlassTint;
  elevation?: GlassElevation;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

export function GlassSurface({
  children,
  className,
  style,
  tint = 'default',
  elevation = 'medium',
  pointerEvents,
}: GlassSurfaceProps) {
  const scheme = useColorScheme();
  const isDark = tint === 'default' ? scheme === 'dark' : tint === 'dark';

  return (
    <View
      pointerEvents={pointerEvents}
      className={cn('overflow-hidden rounded-glass border', isDark ? 'border-white/10' : 'border-white/30', className)}
      style={style}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={blurIntensity[elevation]} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={StyleSheet.absoluteFill} className={isDark ? 'bg-neutral-900/90' : 'bg-white/85'} />
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFill} className={isDark ? 'bg-black/20' : 'bg-white/30'} />
      {children}
    </View>
  );
}
