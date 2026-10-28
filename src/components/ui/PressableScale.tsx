import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

cssInterop(Animated.View, { className: 'style' });

export interface PressableScaleProps {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  scaleTo?: number;
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
  scaleTo = 0.97,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPressIn={() => {
        scale.set(withSpring(scaleTo, { damping: 15, stiffness: 220 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 15, stiffness: 220 }));
      }}
    >
      <Animated.View className={className} style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
