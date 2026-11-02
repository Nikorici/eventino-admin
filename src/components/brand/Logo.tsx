import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const WORDMARK_ASPECT = 206 / 594;
const MARK_ASPECT = 305 / 256;

type BrandGlyphProps = {
  style?: StyleProp<ImageStyle>;
  width?: number;
  height?: number;
};

export function Logo({ width = 132, height, style }: BrandGlyphProps) {
  const isDark = useColorScheme() === 'dark';
  const resolvedHeight = height ?? Math.round(width * WORDMARK_ASPECT);

  return (
    <Image
      source={require('../../../assets/brand/logo.png')}
      contentFit="contain"
      tintColor={isDark ? '#f9f9f9' : undefined}
      style={[{ width, height: resolvedHeight }, style]}
    />
  );
}

export function LogoMark({ width = 40, height, style }: BrandGlyphProps) {
  return (
    <Image
      source={require('../../../assets/brand/halloween-mark.png')}
      contentFit="contain"
      style={[{ width, height: height ?? Math.round(width * MARK_ASPECT) }, style]}
    />
  );
}
