import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const LOGO_WIDTH = 180;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 410) / 1188);
const MIN_VISIBLE_MS = 1000;
const EXIT_MS = 320;
const PULSE = { duration: 650, easing: Easing.inOut(Easing.quad) };

export function AnimatedSplash({ ready, onShown }: { ready: boolean; onShown: () => void }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const screenOpacity = useSharedValue(1);
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    if (!reducedMotion) {
      scale.set(withRepeat(withSequence(withTiming(1.08, PULSE), withTiming(1, PULSE)), -1));
      logoOpacity.set(withRepeat(withSequence(withTiming(0.75, PULSE), withTiming(1, PULSE)), -1));
    }
    return () => clearTimeout(timer);
  }, [reducedMotion, scale, logoOpacity]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    screenOpacity.set(withTiming(0, { duration: EXIT_MS }));
    scale.set(withTiming(1.15, { duration: EXIT_MS }));
    const timer = setTimeout(() => setGone(true), EXIT_MS);
    return () => clearTimeout(timer);
  }, [ready, minElapsed, screenOpacity, scale]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.get() }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.get(), transform: [{ scale: scale.get() }] }));

  if (gone) return null;

  return (
    <Animated.View onLayout={onShown} style={[StyleSheet.absoluteFill, styles.screen, screenStyle]}>
      <Animated.Image
        source={require('../../../assets/images/splash-logo.png')}
        resizeMode="contain"
        style={[{ width: LOGO_WIDTH, height: LOGO_HEIGHT }, logoStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', zIndex: 1000 },
});
