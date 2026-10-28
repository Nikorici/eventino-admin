import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { AppText } from './AppText';
import { GlassButton } from './GlassButton';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center justify-center gap-3 px-8 py-16', className)}>
      {Icon ? (
        <View className="h-16 w-16 items-center justify-center rounded-full border border-app-border bg-card-sm dark:border-dark-border dark:bg-dark-elevated">
          <Icon size={28} color="#8a8d93" />
        </View>
      ) : null}
      <AppText className="text-center font-gilroy-semibold text-lg">{title}</AppText>
      {message ? (
        <AppText className="text-center font-gilroy text-sm text-muted dark:text-dark-muted">{message}</AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-2 w-48">
          <GlassButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
