import type { ReactNode } from 'react';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';

const ENTERING = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));

export function SlideUp({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={ENTERING} style={{ maxHeight: '100%' }}>
      {children}
    </Animated.View>
  );
}
