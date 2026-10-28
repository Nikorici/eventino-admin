import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronLeft } from 'lucide-react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface GlassHeaderProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
  onTitlePress?: () => void;
  titleAccessibilityLabel?: string;
}

export function GlassHeader({ title, onBack, right, transparent, onTitlePress, titleAccessibilityLabel }: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const iconColor = isDark ? '#f9f9f9' : '#2b3a44';

  return (
    <View style={{ paddingTop: insets.top }} className="absolute left-0 right-0 top-0 z-50">
      {!transparent &&
        (isLiquidGlassAvailable() ? (
          <GlassView glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : Platform.OS === 'ios' ? (
          <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={StyleSheet.absoluteFill} className="bg-app-bg/90 dark:bg-dark-bg/90" />
        ))}
      <View className="h-14 flex-row items-center justify-between px-4">
        <View className="w-12">
          {onBack ? (
            <PressableScale
              onPress={onBack}
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <ChevronLeft size={22} color={iconColor} />
            </PressableScale>
          ) : null}
        </View>
        {title && onTitlePress ? (
          <View className="flex-1 items-center">
            <PressableScale
              onPress={onTitlePress}
              accessibilityLabel={titleAccessibilityLabel ?? title}
              className="max-w-full flex-row items-center gap-1 rounded-full px-3 py-1.5"
            >
              <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-base">
                {title}
              </AppText>
              <ChevronDown size={16} color={iconColor} />
            </PressableScale>
          </View>
        ) : title ? (
          <AppText numberOfLines={1} className="flex-1 text-center font-gilroy-semibold text-base">
            {title}
          </AppText>
        ) : (
          <View className="flex-1" />
        )}
        <View className="w-12 items-end">{right}</View>
      </View>
    </View>
  );
}
