import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BarChart3, Globe, Users } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { AppText, EmptyState, Skeleton } from '@/components/ui';

import {
  groupReferrers,
  isDirectReferrer,
  sharePercent,
  sourceDisplayName,
  type GroupedSource,
  type ReferrerInput,
} from './trafficSources';

const CLICKS_COLOR = '#61859d';

export interface TrafficStatsData {
  total_clicks: number;
  paid_orders?: number;
  conversion_rate?: number;
  by_referrer: ReferrerInput[];
}

function MetricCard({ label, value, caption, wide }: { label: string; value: string; caption?: string; wide?: boolean }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className={`${wide ? 'w-full' : 'flex-1'} gap-1 rounded-[12px] border bg-white p-4 dark:bg-dark-surface`}
      style={{ borderColor: cardBorder }}
    >
      <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
        {label}
      </AppText>
      <AppText numberOfLines={1} className="font-gilroy-bold text-[18px]">
        {value}
      </AppText>
      {caption ? <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{caption}</AppText> : null}
    </View>
  );
}

function TrafficSourceRow({ source, total, aggregate }: { source: GroupedSource; total: number; aggregate: boolean }) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const direct = isDirectReferrer(source.referrer);
  const Icon = direct ? Users : Globe;
  const percent = sharePercent(source.totalClicks, total);

  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
          <Icon size={16} color={iconTint} />
        </View>
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {sourceDisplayName(source.referrer, t('Direct Traffic'))}
          </AppText>
          {source.embedSite ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
              {t('via {{site}}', { site: source.embedSite })}
            </AppText>
          ) : null}
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {direct ? t('Direct / Bookmark') : source.referrer}
          </AppText>
        </View>
        <View className="items-end">
          <AppText className="font-gilroy-bold text-[15px]">{source.totalClicks}</AppText>
          <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
            {aggregate ? `${percent}% · ${t('clicks')}` : t('clicks')}
          </AppText>
        </View>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
        <View className="h-full rounded-full" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: CLICKS_COLOR }} />
      </View>
    </View>
  );
}

function RowSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </View>
        <Skeleton className="h-3.5 w-10" />
      </View>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </View>
  );
}

export function TrafficStatsSection({
  aggregate = false,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  aggregate?: boolean;
  data: TrafficStatsData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const sources = useMemo(() => groupReferrers(data?.by_referrer ?? []), [data]);
  const totalClicks = data?.total_clicks ?? 0;

  if (isLoading) {
    return (
      <View className="gap-3">
        <View className="flex-row gap-2.5">
          <Skeleton className="h-[72px] flex-1 rounded-[12px]" />
          <Skeleton className="h-[72px] flex-1 rounded-[12px]" />
        </View>
        {aggregate ? null : <Skeleton className="h-[90px] w-full rounded-[12px]" />}
        <Skeleton className="mt-1 h-5 w-40" />
        <View className="gap-2.5">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('No Traffic Data Yet')}
        message={t('Traffic will appear here once visitors start viewing your event page')}
        actionLabel={t('Try again')}
        onAction={onRetry}
      />
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2.5">
        <MetricCard label={t('Total Visits')} value={String(totalClicks)} />
        <MetricCard label={t('Traffic Sources')} value={String(sources.length)} />
        {aggregate ? null : (
          <MetricCard
            wide
            label={t('Conversion Rate')}
            value={`${data.conversion_rate ?? 0}%`}
            caption={t('{{orders}} orders from {{visits}} visits', { orders: data.paid_orders ?? 0, visits: totalClicks })}
          />
        )}
      </View>
      <AppText className="mt-1 font-gilroy-bold text-[17px]">{t('Source Breakdown')}</AppText>
      {sources.length > 0 ? (
        <View className="gap-2.5">
          {sources.map((source) => (
            <TrafficSourceRow key={source.key} source={source} total={totalClicks} aggregate={aggregate} />
          ))}
        </View>
      ) : (
        <EmptyState icon={BarChart3} title={t('No traffic sources recorded yet')} />
      )}
    </View>
  );
}
