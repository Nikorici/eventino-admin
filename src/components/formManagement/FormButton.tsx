import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

const SIZES = {
  sm: 'h-10 rounded-[10px]',
  field: 'h-12 rounded-[10px]',
  md: 'h-12 rounded-[10px]',
  lg: 'h-[52px] rounded-[12px]',
};

export function FormButton({
  label,
  onPress,
  primary,
  size = 'sm',
  icon,
  trailing,
  loading,
  disabled,
  className,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  size?: keyof typeof SIZES;
  icon?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const spinner = useThemeColor(primary ? colors.white : colors.primary, primary ? colors.primary : colors.dark.text);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center justify-center gap-2 border px-4',
        SIZES[size],
        primary
          ? 'border-transparent bg-primary dark:bg-white'
          : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        disabled && !loading && 'opacity-50',
        className,
      )}
    >
      {loading ? <ActivityIndicator size="small" color={spinner} /> : icon}
      <AppText
        className={cn(
          'font-gilroy-semibold',
          size === 'sm' || size === 'field' ? 'text-[14px] leading-[19px]' : 'text-[16px] leading-[21px]',
          primary && 'text-white dark:text-primary',
        )}
      >
        {label}
      </AppText>
      {trailing}
    </PressableScale>
  );
}
