import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type GlassButtonVariant = 'primary' | 'secondary' | 'light' | 'ghost' | 'accent' | 'glass' | 'danger';
export type GlassButtonSize = 'md' | 'sm';

export interface GlassButtonProps {
  label: string;
  onPress?: () => void;
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const containerByVariant: Record<GlassButtonVariant, string> = {
  primary: 'bg-primary dark:bg-white',
  secondary: 'border border-primary bg-transparent dark:border-white/30',
  light: 'border border-primary bg-transparent dark:border-white/30',
  ghost: 'border border-primary bg-transparent dark:border-white/30',
  accent: 'bg-accent',
  glass: '',
  danger: 'bg-danger',
};

const textByVariant: Record<GlassButtonVariant, string> = {
  primary: 'text-white dark:text-primary',
  secondary: 'text-primary dark:text-dark-text',
  light: 'text-primary dark:text-dark-text',
  ghost: 'text-primary dark:text-dark-text',
  accent: 'text-primary dark:text-primary',
  glass: 'text-primary dark:text-dark-text',
  danger: 'text-white dark:text-white',
};

export function GlassButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth = true,
  className,
}: GlassButtonProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const heightClass = size === 'sm' ? 'h-10 px-4' : 'h-12 px-6';
  const isDisabled = disabled || loading;

  const spinnerColor =
    variant === 'primary'
      ? isDark
        ? '#2b3a44'
        : '#ffffff'
      : variant === 'danger'
        ? '#ffffff'
        : variant === 'accent'
          ? '#2b3a44'
          : isDark
            ? '#f9f9f9'
            : '#2b3a44';

  const inner = (
    <View className={cn('flex-row items-center justify-center gap-2', heightClass)}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <AppText className={cn('font-gilroy-semibold', size === 'sm' ? 'text-sm' : 'text-base', textByVariant[variant])}>
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  const handlePress = () => {
    if (isDisabled) return;
    haptics.light();
    onPress?.();
  };

  if (variant === 'glass') {
    return (
      <PressableScale
        onPress={handlePress}
        disabled={isDisabled}
        accessibilityLabel={label}
        className={cn(
          'overflow-hidden rounded-[10px] border',
          isDark ? 'border-white/15' : 'border-white/40',
          fullWidth && 'w-full',
          isDisabled && 'opacity-70',
          className,
        )}
      >
        {isLiquidGlassAvailable() ? (
          <GlassView glassEffectStyle="regular" isInteractive colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={StyleSheet.absoluteFill} className={isDark ? 'bg-white/10' : 'bg-white/80'} />
        )}
        {inner}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityLabel={label}
      className={cn('rounded-[10px]', fullWidth && 'w-full', containerByVariant[variant], isDisabled && 'opacity-70', className)}
    >
      {inner}
    </PressableScale>
  );
}
