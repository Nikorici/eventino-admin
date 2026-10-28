export const gilroyCriticalFonts = {
  'Gilroy-Regular': require('../../assets/fonts/Gilroy-Regular.ttf'),
  'Gilroy-Medium': require('../../assets/fonts/Gilroy-Medium.ttf'),
  'Gilroy-Semibold': require('../../assets/fonts/Gilroy-Semibold.ttf'),
  'Gilroy-Bold': require('../../assets/fonts/Gilroy-Bold.ttf'),
} as const;

export const gilroyDeferredFonts = {
  'Gilroy-Thin': require('../../assets/fonts/Gilroy-Thin.ttf'),
  'Gilroy-UltraLight': require('../../assets/fonts/Gilroy-UltraLight.ttf'),
  'Gilroy-Light': require('../../assets/fonts/Gilroy-Light.ttf'),
  'Gilroy-Extrabold': require('../../assets/fonts/Gilroy-Extrabold.ttf'),
  'Gilroy-Black': require('../../assets/fonts/Gilroy-Black.ttf'),
  'Gilroy-Heavy': require('../../assets/fonts/Gilroy-Heavy.ttf'),
} as const;

export const gilroyFonts = { ...gilroyCriticalFonts, ...gilroyDeferredFonts } as const;

export type GilroyFamily = keyof typeof gilroyFonts;

export const fontClass = {
  thin: 'font-gilroy-thin',
  ultralight: 'font-gilroy-ultralight',
  light: 'font-gilroy-light',
  regular: 'font-gilroy',
  medium: 'font-gilroy-medium',
  semibold: 'font-gilroy-semibold',
  bold: 'font-gilroy-bold',
  extrabold: 'font-gilroy-extrabold',
  black: 'font-gilroy-black',
  heavy: 'font-gilroy-heavy',
} as const;
