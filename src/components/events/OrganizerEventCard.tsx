import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, MapPin, Ticket, Users } from 'lucide-react-native';

import { AppText, PressableScale, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getEventTimeStatus } from '@/lib/eventStatus';
import { formatEventDay } from '@/lib/format';
import { formatMoney } from '@/lib/pricing';
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

export function OrganizerEventCard({
  event,
  onPress,
  selected,
}: {
  event: OrganizerEventListItem;
  onPress: () => void;
  selected?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const selectedBorder = useThemeColor(colors.primary, colors.dark.text);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const location = [event.region, event.country].filter(Boolean).join(', ');
  const startText = formatEventDay(event.start_date, i18n.language);
  const endText = formatEventDay(event.end_date, i18n.language);
  const dateText = startText && endText && endText !== startText ? `${startText} — ${endText}` : startText;
  const status = organizerEventStatus(event, t);

  return (
    <View
      className="rounded-[12px] bg-white dark:bg-dark-surface"
      style={{ borderColor: selected ? selectedBorder : cardBorder, borderWidth: selected ? 2 : 1 }}
    >
      <PressableScale
        onPress={onPress}
        accessibilityLabel={event.name}
        testID={`event-card-${event.id}`}
        className="w-full overflow-hidden rounded-[12px]"
      >
        <View className="relative aspect-[312/150] w-full overflow-hidden rounded-t-[12px]">
          <BlurredPoster uri={event.image} className="h-full w-full" iconSize={32} recyclingKey={String(event.id)} />
          {status ? (
            <View style={{ backgroundColor: status.color }} className="absolute left-3 top-3 rounded-full px-2.5 py-1">
              <AppText className="font-gilroy-bold text-[10px] uppercase tracking-wide text-white dark:text-white">
                {status.label}
              </AppText>
            </View>
          ) : null}
          {selected ? (
            <View
              className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: ACCENT_GREEN }}
            >
              <Check size={16} color={colors.white} />
            </View>
          ) : null}
        </View>

        <View className="gap-2 px-4 pb-4 pt-3">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[16px] leading-[21px]">
            {event.name}
          </AppText>

          {location ? (
            <View className="flex-row items-center gap-1.5">
              <MapPin size={14} color={colors.muted} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                {location}
              </AppText>
            </View>
          ) : null}

          {dateText ? (
            <View className="flex-row items-center gap-1.5">
              <CalendarDays size={14} color={colors.muted} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[13px] text-primary/80 dark:text-dark-text/80">
                {dateText}
              </AppText>
            </View>
          ) : null}

          <View className="mt-1 flex-row items-center justify-between border-t pt-3" style={{ borderColor: rowDivider }}>
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1.5">
                <Users size={14} color={colors.muted} />
                <AppText className="font-gilroy-semibold text-[13px] text-primary/80 dark:text-dark-text/80">
                  {event.participants_count}
                </AppText>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Ticket size={14} color={colors.muted} />
                <AppText className="font-gilroy-semibold text-[13px] text-primary/80 dark:text-dark-text/80">
                  {event.tickets_count}
                </AppText>
              </View>
            </View>
            <AppText className="font-gilroy-bold text-[15px]" style={{ color: ACCENT_GREEN }}>
              {currencySymbol(event.currency ?? '')} {formatMoney(event.income)}
            </AppText>
          </View>
        </View>
      </PressableScale>
    </View>
  );
}

export function OrganizerEventCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  return (
    <View className="rounded-[12px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <Skeleton className="aspect-[312/150] w-full rounded-b-none rounded-t-[12px]" />
      <View className="gap-2.5 px-4 pb-4 pt-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
        <View className="mt-1 flex-row items-center justify-between border-t pt-3" style={{ borderColor: rowDivider }}>
          <View className="flex-row items-center gap-4">
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-10" />
          </View>
          <Skeleton className="h-4 w-16" />
        </View>
      </View>
    </View>
  );
}
