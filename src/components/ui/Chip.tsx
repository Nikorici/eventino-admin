import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function Chip({ label, selected, onPress, icon, trailing, className }: ChipProps) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      accessibilityLabel={label}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full border px-4',
        selected
          ? 'border-primary bg-primary dark:border-white dark:bg-white'
          : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-white/10',
        className,
      )}
    >
      {icon}
      <AppText
        className={cn(
          'font-gilroy-medium text-sm',
          selected ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text',
        )}
      >
        {label}
      </AppText>
      {trailing}
    </PressableScale>
  );
}
