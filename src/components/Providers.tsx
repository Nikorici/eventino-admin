import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Provider } from 'react-redux';

import { store } from '@/store';

import { ToastHost } from '@/components/ui/Toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <Provider store={store}>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              {children}
              <ToastHost />
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </Provider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
