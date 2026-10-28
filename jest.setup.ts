jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('react-native-reanimated', () => {
  const reanimatedMock = require('react-native-reanimated/mock');
  const React = require('react');
  const useSharedValue = <Value,>(initial: Value) => {
    const ref = React.useRef(null);
    if (ref.current === null) ref.current = reanimatedMock.useSharedValue(initial);
    return ref.current;
  };
  return { ...reanimatedMock, useSharedValue };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-sse', () =>
  jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    removeAllEventListeners: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
  })),
);

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      dismissTo: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
    useRouter: () => require('expo-router').router,
    useLocalSearchParams: jest.fn(() => ({})),
    usePathname: jest.fn(() => '/'),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => effect(), [effect]);
    },
    Redirect: () => null,
    Stack: Object.assign(() => null, { Screen: () => null }),
  };
});

jest.mock('react-i18next', () => {
  const translate = (key: string, options?: Record<string, unknown>) =>
    options ? key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name] ?? '')) : key;
  const i18n = { language: 'en', changeLanguage: jest.fn() };
  return {
    useTranslation: () => ({ t: translate, i18n }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
  };
});

jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return { GlassView: View, GlassContainer: View, isLiquidGlassAvailable: () => false };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
