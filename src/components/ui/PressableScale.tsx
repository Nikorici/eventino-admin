import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { cn } from '@/lib/cn';

export interface PressableScaleProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  testID?: string;
}

export function PressableScale({
  children,
  className,
  style,
  onPress,
  onLongPress,
  disabled,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
}: PressableScaleProps) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={cn(className, !disabled && 'active:scale-[0.97]')}
      style={style}
    >
      {children}
    </Pressable>
  );
}
