import { type ReactNode } from 'react';
import { Plus } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface DashedAddButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  size?: 'md' | 'sm';
  className?: string;
}

export function DashedAddButton({ label, onPress, icon, size = 'md', className }: DashedAddButtonProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-app-border px-4 dark:border-dark-border',
        size === 'sm' ? 'h-11' : 'h-12',
        className,
      )}
    >
      {icon ?? <Plus size={17} color={isDark ? colors.dark.text : colors.primary} />}
      <AppText className="font-gilroy-semibold text-[15px] leading-5">{label}</AppText>
    </PressableScale>
  );
}
