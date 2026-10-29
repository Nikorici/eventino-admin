import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight } from 'lucide-react-native';

import { AppText, PressableScale, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { groupThousands } from '@/lib/currency';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getEventTimeStatus } from '@/lib/eventStatus';
import { formatEventDay } from '@/lib/format';
import type { OrganizerEventListItem } from '@/store/api/organizerApi';
import { colors, currencySymbol } from '@/theme/colors';

export const ACCENT_GREEN = '#34c759';

export function organizerEventStatus(
  event: OrganizerEventListItem,
  t: (key: string) => string,
): { label: string; color: string } | null {
  if (event.is_cancelled) return { label: t('Cancelled'), color: '#ff3b30' };
  if (event.in_draft) return { label: t('Draft'), color: '#8e8e93' };
  switch (getEventTimeStatus(event)) {
    case 'live':
      return { label: t('Live'), color: ACCENT_GREEN };
    case 'today':
      return { label: t('Today'), color: '#f97316' };
    case 'finished':
      return { label: t('Finished'), color: '#ff3b30' };
    case 'upcoming':
      return { label: t('Upcoming'), color: '#ff9500' };
    default:
      return null;
  }
}

function eventDateText(event: OrganizerEventListItem, lang: string): string {
  const startText = formatEventDay(event.start_date, lang);
  const endText = formatEventDay(event.end_date, lang);
  return startText && endText && endText !== startText ? `${startText} — ${endText}` : startText;
}

export function OrganizerEventRow({
  event,
  onPress,
  selected,
  first,
  last,
}: {
  event: OrganizerEventListItem;
  onPress: () => void;
  selected?: boolean;
  first: boolean;
  last: boolean;
}) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const chevronColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const status = organizerEventStatus(event, t);
  const subtitle = [eventDateText(event, i18n.language), event.region].filter(Boolean).join(' · ');

  return (
    <View
      className={cn(
        'mx-4 overflow-hidden border-x bg-white dark:bg-dark-surface',
        first && 'rounded-t-[14px] border-t',
        last && 'rounded-b-[14px] border-b',
      )}
      style={{ borderColor: cardBorder }}
    >
      <PressableScale
        onPress={onPress}
        accessibilityLabel={selected ? `${event.name}, ${t('Selected event')}` : event.name}
        testID={`event-card-${event.id}`}
        className={cn('flex-row items-center gap-3 p-3', selected && 'bg-checkout-indigo-bg dark:bg-brand/20')}
        style={first ? undefined : { borderTopWidth: 1, borderTopColor: rowDivider }}
      >
        <BlurredPoster uri={event.image} className="h-14 w-14 rounded-[10px]" iconSize={20} recyclingKey={String(event.id)} />
        <View className="flex-1 gap-[3px]">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px] leading-[20px]">
            {event.name}
          </AppText>
          {subtitle ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
              {subtitle}
            </AppText>
          ) : null}
          <View className="flex-row items-center gap-2">
            {status ? (
              <View className="h-[18px] justify-center rounded-full px-[7px]" style={{ backgroundColor: status.color }}>
                <AppText className="font-gilroy-bold text-[9px] uppercase tracking-wide text-white dark:text-white">
                  {status.label}
                </AppText>
              </View>
            ) : null}
            <AppText
              numberOfLines={1}
              className="shrink font-gilroy-semibold text-[12px] leading-[16px] text-primary/80 dark:text-dark-text/80"
            >
              {t('{{count}} tickets', { count: event.tickets_count, replace: { count: groupThousands(event.tickets_count) } })}
            </AppText>
            <AppText className="ml-auto font-gilroy-bold text-[13px] leading-[17px]" style={{ color: ACCENT_GREEN }}>
              {`${currencySymbol(event.currency ?? '')} ${groupThousands(event.income)}`}
            </AppText>
          </View>
        </View>
        {selected ? (
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full" style={{ backgroundColor: ACCENT_GREEN }}>
            <Check size={14} color={colors.white} strokeWidth={2.5} />
          </View>
        ) : (
          <ChevronRight size={18} color={chevronColor} />
        )}
      </PressableScale>
    </View>
  );
}

export function OrganizerEventRowSkeleton({ first, last }: { first: boolean; last: boolean }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className={cn(
        'mx-4 flex-row items-center gap-3 border-x bg-white p-3 dark:bg-dark-surface',
        first && 'rounded-t-[14px] border-t',
        last && 'rounded-b-[14px] border-b',
      )}
      style={{ borderColor: cardBorder }}
    >
      <Skeleton className="h-14 w-14 rounded-[10px]" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </View>
    </View>
  );
}
