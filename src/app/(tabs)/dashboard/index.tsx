import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ban, LayoutDashboard } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, Screen } from '@/components/ui';
import { BuyersPanel } from '@/components/dashboard/BuyersPanel';
import {
  AnalyticsChart,
  CARD_BORDER,
  DashboardStatsSection,
  DashboardStatsSkeleton,
} from '@/components/dashboard/DashboardStats';
import { EventActions, EventHeaderCard, EventHeaderCardSkeleton } from '@/components/dashboard/EventHeaderCard';
import { FacturaOrdersPanel, type FacturaTab } from '@/components/dashboard/FacturaOrdersPanel';
import { FreeTicketRequestsPanel } from '@/components/dashboard/FreeTicketRequestsPanel';
import { PendingOrdersPanel } from '@/components/dashboard/PendingOrdersPanel';
import { PanelCard, SectionTitle } from '@/components/dashboard/dashboardParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { eventCurrencyCode } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { eventPermissions } from '@/lib/sections';
import { useGetOrganizerGraphQuery, useGetOrganizerStatsQuery } from '@/store/api/organizerApi';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';

type OrdersTab = 'buyers' | 'pending' | FacturaTab;

const CANCELLED_METRICS = [
  'Total Users',
  'Total Revenue',
  'Tickets Sold',
  'Total Received',
  'Total Tickets',
  'Paid Tickets',
  'Free Tickets',
];

function CancelledStats() {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      {CANCELLED_METRICS.map((label) => (
        <View
          key={label}
          className="w-[48%] rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
          style={{ borderColor: cardBorder }}
        >
          <AppText className="font-gilroy-bold text-[22px] leading-[26px] text-primary">-</AppText>
          <AppText numberOfLines={2} className="mt-1.5 font-gilroy-semibold text-[12px] text-brand">
            {t(label)}
          </AppText>
          <AppText className="mt-0.5 font-gilroy-medium text-[11px] text-muted">{`↗ - ${t('all time')}`}</AppText>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const user = useAppSelector((s) => s.auth.user);
  const { eventId, data: event, isLoading, isError, refetch } = useSelectedEvent();
  const [tab, setTab] = useState<OrdersTab>('buyers');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const permissions = eventPermissions(event, user);
  const isCancelled = Boolean(event?.is_cancelled);
  const showAnalytics = Boolean(event) && permissions.canViewAnalytics;
  const showStats = showAnalytics && !isCancelled;
  const stats = useGetOrganizerStatsQuery(eventId ?? undefined, {
    skip: !showStats,
  });
  const graph = useGetOrganizerGraphQuery({ interval: 'day', eventId: eventId ?? undefined }, { skip: !showAnalytics });

  const tabs: { key: OrdersTab; label: string }[] = [
    ...(permissions.canViewBuyers ? [{ key: 'buyers' as const, label: t('Event buyers') }] : []),
    ...(permissions.canManageOrders
      ? [
          { key: 'pending' as const, label: t('Pending orders') },
          { key: 'bank_transfers' as const, label: t('Bank transfers') },
          { key: 'persoane_juridice' as const, label: t('Persoane juridice') },
          { key: 'persoane_fizice' as const, label: t('Persoane fizice') },
        ]
      : []),
  ];
  const activeTab = tabs.some((item) => item.key === tab) ? tab : (tabs[0]?.key ?? null);

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshSignal((current) => current + 1);
    try {
      await Promise.all([
        ...(eventId != null ? [refetch()] : []),
        ...(showStats ? [stats.refetch()] : []),
        ...(showAnalytics ? [graph.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <GlassHeader
      title={event?.title ?? t('Dashboard')}
      onTitlePress={navigate.selectEvent}
      titleAccessibilityLabel={t('Change event')}
    />
  );

  if (isError && !event) {
    return (
      <Screen edges={[]}>
        {header}
        <View className="flex-1 justify-center" style={{ paddingTop: padding.top, paddingBottom: padding.bottom }}>
          <EmptyState
            icon={LayoutDashboard}
            title={t('Something went wrong.')}
            message={t('Please try again.')}
            actionLabel={t('Try again')}
            onAction={() => void refetch()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      {header}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: padding.top + 8,
          paddingBottom: padding.bottom,
          paddingHorizontal: 16,
          gap: 24,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />
        }
      >
        {isLoading || !event || eventId == null ? (
          <>
            <EventHeaderCardSkeleton />
            <DashboardStatsSkeleton />
          </>
        ) : (
          <>
            <View className="gap-3">
              <EventHeaderCard event={event} />
              <EventActions event={event} permissions={permissions} isStaffUser={Boolean(user?.is_staff)} />
            </View>

            {permissions.canViewAnalytics ? (
              <View className="gap-3">
                <SectionTitle>{t('Statistics')}</SectionTitle>
                {isCancelled ? (
                  <>
                    <CancelledStats />
                    <AnalyticsChart eventId={eventId} currencies={[eventCurrencyCode(event)]} />
                  </>
                ) : (
                  <DashboardStatsSection eventId={eventId} />
                )}
              </View>
            ) : null}

            <View className="gap-4">
              {isCancelled ? (
                <PanelCard className="flex-row items-center gap-3 py-4">
                  <Ban size={20} color={colors.danger} />
                  <AppText className="flex-1 font-gilroy-semibold text-[14px]">
                    {t('Event cancelled, no orders and customers.')}
                  </AppText>
                </PanelCard>
              ) : null}

              {tabs.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="-mx-4 grow-0"
                  contentContainerClassName="gap-2 px-4"
                >
                  {tabs.map((item) => (
                    <Chip key={item.key} label={item.label} selected={activeTab === item.key} onPress={() => setTab(item.key)} />
                  ))}
                </ScrollView>
              ) : null}

              {activeTab === 'buyers' ? (
                <BuyersPanel eventId={eventId} isCancelled={isCancelled} refreshSignal={refreshSignal} />
              ) : null}
              {activeTab === 'pending' ? (
                <PendingOrdersPanel
                  eventId={eventId}
                  currency={eventCurrencyCode(event)}
                  isCancelled={isCancelled}
                  refreshSignal={refreshSignal}
                />
              ) : null}
              {activeTab === 'bank_transfers' || activeTab === 'persoane_juridice' || activeTab === 'persoane_fizice' ? (
                <FacturaOrdersPanel
                  key={activeTab}
                  eventId={eventId}
                  currency={eventCurrencyCode(event)}
                  isCancelled={isCancelled}
                  tab={activeTab}
                  refreshSignal={refreshSignal}
                />
              ) : null}
            </View>

            {permissions.canManageOrders && event.free_ticket_approval_enabled && !isCancelled ? (
              <FreeTicketRequestsPanel eventId={eventId} refreshSignal={refreshSignal} />
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
