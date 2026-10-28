import { useEffect, useState } from 'react';
import { StyleSheet, View, type ColorValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const SHIMMER_LOCATIONS: readonly [number, number, number] = [0.3, 0.5, 0.7];
const SWEEP_DURATION = 1100;
const SWEEP_PAUSE = 350;

export function Skeleton({ className, style }: SkeletonProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    progress.value = withRepeat(
      withDelay(SWEEP_PAUSE, withTiming(1, { duration: SWEEP_DURATION, easing: Easing.inOut(Easing.ease) })),
      -1,
      false,
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + progress.value * 2 * width }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const shimmerColors: readonly [ColorValue, ColorValue, ColorValue] = [
    'transparent',
    isDark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.85)',
    'transparent',
  ];

  return (
    <View onLayout={onLayout} style={style} className={cn('overflow-hidden rounded-glass-sm bg-black/[0.08] dark:bg-white/10', className)}>
      {width > 0 ? (
        <AnimatedGradient
          colors={shimmerColors}
          locations={SHIMMER_LOCATIONS}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 0.6 }}
          style={[StyleSheet.absoluteFill, shimmerStyle]}
        />
      ) : null}
    </View>
  );
}
