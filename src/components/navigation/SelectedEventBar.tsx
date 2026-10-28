import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight } from 'lucide-react-native';

import { AppText, PressableScale, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatEventDay } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';

export function SelectedEventBar() {
  const { t, i18n } = useTranslation();
  const { data: event, isLoading } = useSelectedEvent();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const iconColor = useThemeColor(colors.primary, colors.dark.text);

  if (isLoading || !event) {
    return (
      <View className="flex-row items-center gap-3 rounded-[14px] border bg-white p-3 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <Skeleton className="h-11 w-11 rounded-[10px]" />
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </View>
      </View>
    );
  }

  return (
    <PressableScale onPress={navigate.selectEvent} accessibilityLabel={t('Change event')}>
      <View className="flex-row items-center gap-3 rounded-[14px] border bg-white p-3 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <BlurredPoster uri={event.images[0] ?? null} className="h-11 w-11 rounded-[10px]" iconSize={18} recyclingKey={String(event.id)} />
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
            {event.title}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
            {formatEventDay(event.start_date, i18n.language)}
          </AppText>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
          <ArrowLeftRight size={16} color={iconColor} />
        </View>
      </View>
    </PressableScale>
  );
}
