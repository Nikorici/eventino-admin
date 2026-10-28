import type { SvgProps } from 'react-native-svg';

import GoogleGlyph from '@/assets/brand/google-button.svg';

type GoogleIconProps = Pick<SvgProps, 'style'> & {
  size?: number;
};

export function GoogleIcon({ size = 20, style }: GoogleIconProps) {
  return <GoogleGlyph width={size} height={size} style={style} />;
}
