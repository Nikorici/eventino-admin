import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

export interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

export const GlassInput = forwardRef<TextInput, GlassInputProps>(function GlassInput(
  { label, error, leftIcon, rightIcon, containerClassName, className, ...props },
  ref,
) {
  return (
    <View className={cn('w-full gap-1.5', containerClassName)}>
      {label ? <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{label}</AppText> : null}
      <View
        className={cn(
          'h-12 flex-row items-center gap-2 rounded-[10px] border bg-app-surface px-3 dark:bg-dark-surface',
          error ? 'border-danger' : 'border-app-border dark:border-dark-border',
        )}
      >
        {leftIcon}
        <TextInput
          ref={ref}
          placeholderTextColor="#8a8d93"
          textAlignVertical={props.multiline ? 'top' : 'center'}
          style={{ includeFontPadding: false }}
          className={cn(
            'h-full flex-1 font-gilroy text-primary dark:text-dark-text',
            props.multiline ? 'text-base' : 'text-[16px]',
            className,
          )}
          {...props}
        />
        {rightIcon}
      </View>
      {error ? <AppText className="font-gilroy-medium text-xs text-danger dark:text-danger">{error}</AppText> : null}
    </View>
  );
});
