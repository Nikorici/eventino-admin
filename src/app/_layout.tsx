import '@/global.css';
import { loadPersistedLanguage } from '@/lib/i18n';

import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

import { AnimatedSplash } from '@/components/brand/AnimatedSplash';
import { Providers } from '@/components/Providers';
import { useBootstrapAuth } from '@/hooks/useAuth';
import { useBootstrapSelectedEvent } from '@/hooks/useSelectedEvent';
import { useBootstrapTheme } from '@/hooks/useThemePreference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';
import { gilroyCriticalFonts, gilroyDeferredFonts } from '@/theme/fonts';

LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate`']);

enableFreeze(true);

SplashScreen.preventAutoHideAsync().catch(() => undefined);
void loadPersistedLanguage();

const lightNavigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background } };
const darkNavigationTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.dark.background } };

function ThemedSystemUI() {
  const scheme = useColorScheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(scheme === 'dark' ? colors.dark.background : colors.background).catch(() => undefined);
  }, [scheme]);
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const restored = useAppSelector((s) => s.selectedEvent.restored);
  const scheme = useColorScheme();

  useBootstrapAuth();
  useBootstrapTheme();
  useBootstrapSelectedEvent();

  return (
    <ThemeProvider value={scheme === 'dark' ? darkNavigationTheme : lightNavigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
        <Stack.Screen name="select-event" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="create-event" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <AnimatedSplash
        ready={!isBootstrapping && restored}
        onShown={() => {
          SplashScreen.hideAsync().catch(() => undefined);
        }}
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(gilroyCriticalFonts);
  useFonts(gilroyDeferredFonts);

  if (!loaded) return null;

  return (
    <Providers>
      <ThemedSystemUI />
      <RootNavigator />
    </Providers>
  );
}
