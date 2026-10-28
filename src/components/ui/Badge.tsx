import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';

export interface BadgeProps {
  label: string;
  className?: string;
  textClassName?: string;
}

export function Badge({ label, className, textClassName }: BadgeProps) {
  return (
    <View className={cn('self-start rounded-[4px] px-2 py-1', className)}>
      <AppText className={cn('font-gilroy-bold text-[12px] uppercase tracking-wide', textClassName)}>{label}</AppText>
    </View>
  );
}
