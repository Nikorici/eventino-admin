import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { eventRecency, type EventRecency } from '@/lib/format';
import type { EventListItem } from '@/types/api';
import { AppText } from '@/components/ui/AppText';

const config: Record<EventRecency, { label: string; bg: string; lightSurface?: boolean }> = {
  passed: { label: 'Past Event', bg: '#e0e0e0', lightSurface: true },
  live: { label: 'Live', bg: '#16a34a' },
  today: { label: 'Today', bg: '#f97316' },
  tomorrow: { label: 'Tomorrow', bg: '#d83636' },
  this_week: { label: 'This Week', bg: '#2563eb' },
  under_week: { label: 'In under a week', bg: '#3f87f5' },
  this_month: { label: 'This month', bg: '#9b59b6' },
  next_month: { label: 'Next month', bg: '#ff6347' },
  next_year: { label: 'Next year', bg: '#808080' },
};

export interface StatusBadgeProps {
  event: EventListItem;
  className?: string;
  recency?: EventRecency | null;
}

export function StatusBadge({ event, className, recency: recencyProp }: StatusBadgeProps) {
  const { t } = useTranslation();
  const recency = recencyProp !== undefined ? recencyProp : eventRecency(event);
  if (!recency) return null;

  const { label, bg, lightSurface } = config[recency];

  return (
    <View
      style={{ backgroundColor: bg }}
      className={cn('self-start rounded-[4px] px-2 py-1', className)}
    >
      <AppText
        className={cn(
          'font-gilroy-bold text-[12px] uppercase tracking-wide',
          lightSurface ? 'text-primary dark:text-primary' : 'text-white dark:text-white',
        )}
      >
        {t(label)}
      </AppText>
    </View>
  );
}
