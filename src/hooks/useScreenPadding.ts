import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const HEADER_CLEARANCE = 72;
export const TAB_BAR_CLEARANCE = 112;
const NATIVE_TAB_BAR_HEIGHT = 49;

export function sheetBottomPad(bottomInset: number): number {
  return Math.max(bottomInset - 14, 12);
}

export function useFloatingBarOffset(gap = 12): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return insets.bottom + TAB_BAR_CLEARANCE - gap;
  return insets.bottom + NATIVE_TAB_BAR_HEIGHT + gap;
}

export function useScreenPadding(options?: { tabBar?: boolean }): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const tabBar = options?.tabBar ?? true;
  return {
    top: insets.top + HEADER_CLEARANCE,
    bottom: insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : 40),
  };
}

export interface ScrollInsets {
  paddingTop: number;
  paddingBottom: number;
  refreshOffset: number;
  scrollProps: {
    contentInset?: { top: number };
    contentOffset?: { x: number; y: number };
    scrollIndicatorInsets?: { top: number };
    automaticallyAdjustContentInsets?: boolean;
  };
}

export function useScrollInsets(options?: { tabBar?: boolean; topOffset?: number }): ScrollInsets {
  const padding = useScreenPadding(options);
  const top = padding.top + (options?.topOffset ?? 0);
  if (Platform.OS !== 'ios') {
    return { paddingTop: top, paddingBottom: padding.bottom, refreshOffset: top, scrollProps: {} };
  }
  return {
    paddingTop: 0,
    paddingBottom: padding.bottom,
    refreshOffset: 0,
    scrollProps: {
      contentInset: { top },
      contentOffset: { x: 0, y: -top },
      scrollIndicatorInsets: { top },
      automaticallyAdjustContentInsets: false,
    },
  };
}
