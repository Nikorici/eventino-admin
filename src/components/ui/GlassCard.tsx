import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cn } from '@/lib/cn';
import { glassShadow } from '@/theme/glass';

import { type GlassSurfaceProps } from './GlassSurface';
import { PressableScale } from './PressableScale';

export interface GlassCardProps extends Omit<GlassSurfaceProps, 'children'> {
  children?: ReactNode;
  onPress?: () => void;
  shadow?: boolean;
  accessibilityLabel?: string;
}

export function GlassCard({ children, className, style, onPress, shadow = true, accessibilityLabel, pointerEvents }: GlassCardProps) {
  const card = (
    <View
      pointerEvents={pointerEvents}
      className={cn(
        'overflow-hidden rounded-glass-sm border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        className,
      )}
      style={[shadow ? glassShadow : undefined, style as StyleProp<ViewStyle>]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
        {card}
      </PressableScale>
    );
  }
  return card;
}
