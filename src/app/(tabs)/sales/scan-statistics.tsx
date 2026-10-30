import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ban, BarChart2, CheckCircle, Circle, RefreshCw, type LucideIcon } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, PressableScale, Screen, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ACCENT_GREEN, PanelCard, PanelMessage, SectionTitle } from '@/components/dashboard/dashboardParts';
import { ProgressStatCard, ProgressStatCardSkeleton } from '@/components/sales-reports/ProgressStatCard';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetScannedTicketsStatsQuery } from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

function SummaryCard({ icon: Icon, label, value, wide }: { icon: LucideIcon; label: string; value: string; wide?: boolean }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className={cn('rounded-[12px] border bg-white p-4 dark:bg-dark-surface', wide ? 'w-full' : 'w-[48%]')}
      style={{ borderColor: cardBorder }}
    >
      <View className="flex-row items-start justify-between">
        <AppText className="font-gilroy-bold text-[22px] leading-[26px] text-primary dark:text-dark-text">{value}</AppText>
        <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${colors.accent}1a` }}>
          <Icon size={17} color={colors.accent} />
        </View>
      </View>
      <AppText numberOfLines={1} className="mt-1.5 font-gilroy-semibold text-[12px]" style={{ color: colors.accent }}>
        {label}
      </AppText>
    </View>
  );
}

function SummarySkeleton() {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      <Skeleton className="h-[92px] w-[48%] rounded-[12px]" />
      <Skeleton className="h-[92px] w-[48%] rounded-[12px]" />
      <Skeleton className="h-[92px] w-full rounded-[12px]" />
    </View>
  );
}

export default function ScanStatisticsScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const headerIconTint = useThemeColor('#2b3a44', '#f9f9f9');
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const [refreshing, setRefreshing] = useState(false);

  const isCancelled = Boolean(event?.is_cancelled);
  const canQuery = eventId != null && Boolean(event) && !isCancelled;
  const stats = useGetScannedTicketsStatsQuery(eventId ?? 0, { skip: !canQuery });
  const ticketTypes = stats.data?.ticket_types ?? [];
  const totalTickets = ticketTypes.reduce((sum, item) => sum + item.total_tickets, 0);
  const totalScanned = ticketTypes.reduce((sum, item) => sum + item.scanned_tickets, 0);
  const overallPercentage = totalTickets > 0 ? ((totalScanned / totalTickets) * 100).toFixed(2) : '0';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), ...(canQuery ? [stats.refetch()] : [])]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (eventError && !event) {
      return (
        <EmptyState
          icon={BarChart2}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (isCancelled) {
      return (
        <PanelCard className="flex-row items-center gap-3 py-4">
          <Ban size={20} color={colors.danger} />
          <AppText className="flex-1 font-gilroy-semibold text-[14px]">
            {t('Event cancelled, no scan statistics available.')}
          </AppText>
        </PanelCard>
      );
    }
    if (eventLoading || !event || stats.isLoading) {
      return (
        <>
          <SummarySkeleton />
          <View className="gap-3">
            <ProgressStatCardSkeleton />
            <ProgressStatCardSkeleton />
          </View>
        </>
      );
    }
    if (stats.isError && ticketTypes.length === 0) {
      return (
        <EmptyState
          icon={BarChart2}
          title={t('No Ticket Data Yet')}
          message={t('Scan statistics will appear here once tickets are sold and scanned')}
          actionLabel={t('Try again')}
          onAction={() => void stats.refetch()}
        />
      );
    }
    return (
      <>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <SummaryCard icon={CheckCircle} label={t('Total Scanned')} value={String(totalScanned)} />
          <SummaryCard icon={BarChart2} label={t('Total Tickets')} value={String(totalTickets)} />
          <SummaryCard icon={Circle} label={t('Scan Rate')} value={`${overallPercentage}%`} wide />
        </View>
        <View className="gap-3">
          <SectionTitle>{t('Ticket Types')}</SectionTitle>
          {ticketTypes.length > 0 ? (
            ticketTypes.map((item) => (
              <ProgressStatCard
                key={item.id}
                title={item.name}
                badge={`${item.scan_percentage}%`}
                ratio={item.total_tickets > 0 ? item.scanned_tickets / item.total_tickets : 0}
                barColor={ACCENT_GREEN}
                stats={[
                  { label: t('Scanned'), value: item.scanned_tickets },
                  { label: t('Unscanned'), value: item.unscanned_tickets },
                  { label: t('Total'), value: item.total_tickets },
                ]}
              />
            ))
          ) : (
            <PanelMessage text={t('No ticket types available')} />
          )}
        </View>
      </>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Ticket Scan Statistics')}
        onBack={navigate.back}
        right={
          canQuery ? (
            <PressableScale
              onPress={() => {
                void haptics.selection();
                void stats.refetch();
              }}
              disabled={stats.isFetching}
              accessibilityLabel={t('Refresh')}
              className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              {stats.isFetching ? (
                <ActivityIndicator size="small" color={headerIconTint} />
              ) : (
                <RefreshCw size={18} color={headerIconTint} />
              )}
            </PressableScale>
          ) : null
        }
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: padding.top + 8,
          paddingBottom: padding.bottom,
          paddingHorizontal: 16,
          gap: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />
        }
      >
        <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">{t('Track scanned tickets by type')}</AppText>
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}
