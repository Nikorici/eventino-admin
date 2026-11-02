import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

export function KeyboardPadding({ children }: { children: ReactNode }) {
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        keyboardHeight.value = event.height;
      },
      onInteractive: (event) => {
        'worklet';
        keyboardHeight.value = event.height;
      },
      onEnd: (event) => {
        'worklet';
        keyboardHeight.value = event.height;
      },
    },
    [],
  );
  const padding = useAnimatedStyle(() => ({ paddingBottom: keyboardHeight.value }));
  return <Animated.View style={[{ flex: 1 }, padding]}>{children}</Animated.View>;
}
