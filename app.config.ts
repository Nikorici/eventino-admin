import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Eventino Admin',
  slug: 'eventino-admin',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'eventino-admin',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    userInterfaceStyle: 'automatic',
    bundleIdentifier: 'co.eventino.admin',
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Eventino Admin uses the camera to scan event tickets.',
      NSPhotoLibraryUsageDescription: 'Eventino Admin accesses your photos to upload event posters.',
    },
  },
  android: {
    package: 'co.eventino.admin',
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
      backgroundColor: '#ffffff',
    },
    permissions: ['CAMERA'],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-camera',
      {
        cameraPermission: 'Eventino Admin uses the camera to scan event tickets.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Eventino Admin accesses your photos to upload event posters.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/images/splash-icon.png',
          backgroundColor: '#0a0d10',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: false,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    useMocks: process.env.EXPO_PUBLIC_USE_MOCKS,
  },
});
