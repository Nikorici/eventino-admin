import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

import { AppText } from './AppText';

export interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
  variant?: 'default' | 'search';
}

export const GlassInput = forwardRef<TextInputInstance, GlassInputProps>(function GlassInput(
  { label, error, leftIcon, rightIcon, containerClassName, className, variant = 'default', ...props },
  ref,
) {
  const multiline = Boolean(props.multiline);
  const search = variant === 'search';
  return (
    <View className={cn('w-full gap-1.5', containerClassName)}>
      {label ? (
        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{label}</AppText>
      ) : null}
      <View
        className={cn(
          'flex-row gap-2 rounded-[10px] border bg-app-surface px-3 dark:bg-dark-surface',
          multiline ? 'min-h-24 items-start py-3' : search ? 'h-11 items-center' : 'h-12 items-center',
          error ? 'border-danger' : 'border-app-border dark:border-dark-border',
        )}
      >
        {leftIcon ? <View className="shrink-0">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          selectionColor={colors.links}
          cursorColor={colors.links}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={{ includeFontPadding: false }}
          className={cn(
            'min-w-0 flex-1 font-gilroy text-primary dark:text-dark-text',
            multiline ? 'self-stretch p-0 text-base leading-[22px]' : search ? 'h-full text-[15px]' : 'h-full text-[16px]',
            className,
          )}
          {...props}
        />
        {rightIcon ? <View className="shrink-0">{rightIcon}</View> : null}
      </View>
      {error ? <AppText className="font-gilroy-medium text-xs text-danger dark:text-danger">{error}</AppText> : null}
    </View>
  );
});
