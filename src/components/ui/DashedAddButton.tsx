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
  className?: string;
}

export function DashedAddButton({ label, onPress, icon, className }: DashedAddButtonProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-[12px] border border-dashed border-links/60 bg-links/10 py-3 dark:border-white/45 dark:bg-white/[0.12]',
        className,
      )}
    >
      {icon ?? <Plus size={17} color={isDark ? colors.white : colors.links} />}
      <AppText className="font-gilroy-semibold text-[14px] text-links dark:text-white">{label}</AppText>
    </PressableScale>
  );
}
