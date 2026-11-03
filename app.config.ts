import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Eventino Admin',
  slug: 'eventino-admin',
  owner: 'eventino',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: ['eventino-admin', 'com.googleusercontent.apps.758097820031-56h61m66826rf3rcih5ea1ucpg6l0631'],
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  ios: {
    supportsTablet: false,
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
        image: './assets/images/splash-logo.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
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
    eas: { projectId: '4ce55d4c-8f24-46af-9128-31d6e76ca34d' },
  },
});
