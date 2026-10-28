import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const HEADER_CLEARANCE = 68;
export const TAB_BAR_CLEARANCE = 100;

export function useScreenPadding(options?: { tabBar?: boolean }): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const tabBar = options?.tabBar ?? true;
  return {
    top: insets.top + HEADER_CLEARANCE,
    bottom: insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : 40),
  };
}
