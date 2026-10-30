import { useState } from 'react';
import { RefreshControl, ScrollView, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ban, Ticket } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, Screen } from '@/components/ui';
import { PanelCard, SectionTitle, moneyLabel } from '@/components/dashboard/dashboardParts';
import { ProgressStatCard, ProgressStatCardSkeleton } from '@/components/sales-reports/ProgressStatCard';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { eventCurrencyCode } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetTicketTypeSalesQuery, type TicketTypeSale } from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

function soldOf(ticketType: TicketTypeSale, excludeZeroOrders: boolean): number {
  return excludeZeroOrders
    ? (ticketType.sold_quantity_excluding_zero ?? ticketType.sold_quantity ?? 0)
    : (ticketType.sold_quantity ?? 0);
}

export default function TicketTypeSalesScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const [excludeZeroOrders, setExcludeZeroOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);

  const isCancelled = Boolean(event?.is_cancelled);
  const sales = useGetTicketTypeSalesQuery(eventId ?? 0, { skip: eventId == null || !event || isCancelled });
  const ticketTypes = sales.data?.ticket_types ?? [];
  const fallbackCurrency = event ? eventCurrencyCode(event) : '';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), ...(event && !isCancelled ? [sales.refetch()] : [])]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (eventError && !event) {
      return (
        <EmptyState
          icon={Ticket}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (eventLoading || !event || sales.isLoading) {
      return (
        <View className="gap-3">
          <ProgressStatCardSkeleton />
          <ProgressStatCardSkeleton />
          <ProgressStatCardSkeleton />
        </View>
      );
    }
    if (isCancelled) {
      return (
        <PanelCard className="flex-row items-center gap-3 py-4">
          <Ban size={20} color={colors.danger} />
          <AppText className="flex-1 font-gilroy-semibold text-[14px]">{t('Event cancelled, no ticket type sales.')}</AppText>
        </PanelCard>
      );
    }
    if (sales.isError && !sales.data) {
      return (
        <EmptyState
          icon={Ticket}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void sales.refetch()}
        />
      );
    }
    return (
      <>
        <PanelCard className="flex-row items-center justify-between gap-3 py-3">
          <AppText className="flex-1 font-gilroy-semibold text-[14px]">{t('Exclude orders with total 0')}</AppText>
          <Switch
            value={excludeZeroOrders}
            onValueChange={(next) => {
              void haptics.selection();
              setExcludeZeroOrders(next);
            }}
            accessibilityLabel={t('Exclude orders with total 0')}
            trackColor={{ true: switchTrackOn, false: switchTrackOff }}
            thumbColor={colors.white}
          />
        </PanelCard>
        {ticketTypes.length > 0 ? (
          <View className="gap-3">
            <SectionTitle>{t('Ticket sales')}</SectionTitle>
            {ticketTypes.map((ticketType) => {
              const sold = soldOf(ticketType, excludeZeroOrders);
              const total = ticketType.total_quantity;
              return (
                <ProgressStatCard
                  key={ticketType.id}
                  title={ticketType.name || '-'}
                  badge={moneyLabel(ticketType.price, ticketType.currency || fallbackCurrency)}
                  ratio={total != null && total > 0 ? sold / total : null}
                  barColor={colors.accent}
                  stats={[
                    { label: t('Sold'), value: sold },
                    ...(total != null ? [{ label: t('Total'), value: total }] : []),
                  ]}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState icon={Ticket} title={t('No ticket type sales yet')} />
        )}
      </>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Ticket Type Sales')} onBack={navigate.back} />
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
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}
