import { View } from 'react-native';

import { AppText, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ACCENT_GREEN } from '@/components/dashboard/dashboardParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { colors } from '@/theme/colors';

export interface ProgressStat {
  label: string;
  value: string | number;
}

export function ProgressStatCard({
  title,
  badge,
  ratio,
  barColor,
  stats,
}: {
  title: string;
  badge: string;
  ratio: number | null;
  barColor: string;
  stats: ProgressStat[];
}) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const [first, ...rest] = stats;
  return (
    <View className="rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between gap-2">
        <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[15px]">
          {title}
        </AppText>
        <AppText className="font-gilroy-bold text-[14px]" style={{ color: ACCENT_GREEN }}>
          {badge}
        </AppText>
      </View>

      {ratio != null ? (
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <View
            style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, backgroundColor: barColor }}
            className="h-full rounded-full"
          />
        </View>
      ) : null}

      <View className="mt-2 flex-row justify-between gap-2">
        {first ? (
          <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {`${first.label}: `}
            <AppText className="font-gilroy-bold text-[12px] text-primary dark:text-dark-text">{first.value}</AppText>
          </AppText>
        ) : null}
        {rest.map((stat) => (
          <AppText key={stat.label} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {`${stat.label}: ${stat.value}`}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function ProgressStatCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row justify-between">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-14" />
      </View>
      <Skeleton className="h-2 w-full rounded-full" />
      <View className="flex-row justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </View>
    </View>
  );
}
