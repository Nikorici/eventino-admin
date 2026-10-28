import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <View className={cn('h-11 flex-row rounded-full border border-app-border bg-white/70 p-1 dark:border-dark-border dark:bg-white/10', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <View key={option.value} className="flex-1">
            <PressableScale
              onPress={() => {
                if (active) return;
                haptics.selection();
                onChange(option.value);
              }}
              accessibilityLabel={option.label}
              className={cn('w-full items-center justify-center rounded-full py-1.5', active && 'bg-primary dark:bg-white')}
            >
              <AppText
                numberOfLines={1}
                className={cn(
                  'font-gilroy-semibold text-sm',
                  active ? 'text-white dark:text-primary' : 'text-primary/70 dark:text-dark-text/70',
                )}
              >
                {option.label}
              </AppText>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
