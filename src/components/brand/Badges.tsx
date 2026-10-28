import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import VerifiedGlyph from '@/assets/brand/verified.svg';
import LogoMarkGlyph from '@/assets/brand/logo-navbar.svg';

const MARK_ASPECT = 206 / 171;

export function VerifiedBadge({ size = 20, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <VerifiedGlyph width={size} height={size} />
    </View>
  );
}

export function EliteAvatarBadge({ size = 34, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const markWidth = Math.round(size * 0.62);
  return (
    <View
      style={style}
      className="items-center justify-center rounded-[9px] border border-app-border bg-white dark:border-dark-border"
    >
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <LogoMarkGlyph width={markWidth} height={Math.round(markWidth * MARK_ASPECT)} />
      </View>
    </View>
  );
}
