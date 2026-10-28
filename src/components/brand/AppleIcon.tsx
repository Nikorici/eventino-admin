import type { SvgProps } from 'react-native-svg';

import AppleGlyph from '@/assets/brand/apple-button.svg';

type AppleIconProps = Pick<SvgProps, 'style' | 'color'> & {
  size?: number;
};

export function AppleIcon({ size = 20, color, style }: AppleIconProps) {
  return <AppleGlyph width={size} height={size} color={color} style={style} />;
}
