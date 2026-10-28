import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info, XCircle } from 'lucide-react-native';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { hideToast, type ToastType } from '@/store/slices/uiSlice';

import { AppText } from './AppText';
import { GlassSurface } from './GlassSurface';

const iconByType: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const colorByType: Record<ToastType, string> = {
  success: '#15dd7d',
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
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]} className="z-[100] items-center">
      <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp} className="px-4">
        <GlassSurface elevation="high" className="flex-row items-center gap-3 rounded-glass px-4 py-3">
          <Icon size={20} color={colorByType[toast.type]} />
          <AppText className="max-w-[260px] font-gilroy-medium text-sm">{toast.message}</AppText>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}
