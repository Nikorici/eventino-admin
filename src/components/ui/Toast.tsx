import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Info, CircleX } from 'lucide-react-native';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { hideToast, type ToastType } from '@/store/slices/uiSlice';
import { glassShadow } from '@/theme/glass';

import { AppText } from './AppText';

const iconByType: Record<ToastType, typeof Info> = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
};

const colorByType: Record<ToastType, string> = {
  success: '#34c759',
  error: '#d83636',
  info: '#61859d',
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toast = useAppSelector((s) => s.ui.toast);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => dispatch(hideToast()), 3200);
    return () => clearTimeout(handle);
  }, [toast, dispatch]);

  if (!toast) return null;

  const Icon = iconByType[toast.type];

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]} className="z-[100] px-4">
      <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp}>
        <View
          style={glassShadow}
          className="flex-row items-center gap-2.5 rounded-[14px] border border-app-border bg-app-surface px-3.5 py-3 dark:border-dark-border dark:bg-dark-surface"
        >
          <Icon size={20} color={colorByType[toast.type]} />
          <AppText className="flex-1 font-gilroy-semibold text-sm">{toast.message}</AppText>
        </View>
      </Animated.View>
    </View>
  );
}
