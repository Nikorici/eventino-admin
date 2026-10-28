import '@/global.css';
import { loadPersistedLanguage } from '@/lib/i18n';

import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { Providers } from '@/components/Providers';
import { useBootstrapAuth } from '@/hooks/useAuth';
import { useBootstrapSelectedEvent } from '@/hooks/useSelectedEvent';
import { useBootstrapTheme } from '@/hooks/useThemePreference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSelector } from '@/store/hooks';
import { gilroyCriticalFonts, gilroyDeferredFonts } from '@/theme/fonts';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate`']);

enableFreeze(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);
void loadPersistedLanguage();

function ThemedStatusBar() {
  const scheme = useColorScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const restored = useAppSelector((s) => s.selectedEvent.restored);

  useBootstrapAuth();
  useBootstrapTheme();
  useBootstrapSelectedEvent();

  useEffect(() => {
    if (!isBootstrapping && restored) SplashScreen.hideAsync().catch(() => undefined);
  }, [isBootstrapping, restored]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="select-event" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="create-event" options={{ presentation: 'modal' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(gilroyCriticalFonts);
  useFonts(gilroyDeferredFonts);

  if (!loaded) return null;

  return (
    <Providers>
      <ThemedStatusBar />
      <RootNavigator />
    </Providers>
  );
}
