import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, ShoppingBag } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, Screen } from '@/components/ui';
import { XLSX_SHARE, useFileAction } from '@/components/dashboard/dashboardParts';
import {
  Card,
  ListSkeleton,
  MerchNav,
  SecondaryButton,
  StatusBadge,
  formatDateTime,
  fulfillmentColor,
  money,
  paymentColor,
} from '@/components/merch/merchParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { organizerTicketEndpoint } from '@/lib/constants';
import { downloadAuthedFile } from '@/lib/downloads';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  MERCH_PAYMENT_STATUSES,
  useGetMerchOrdersByStatusQuery,
  type MerchOrder,
  type MerchPaymentStatus,
} from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

type StatusFilter = '' | MerchPaymentStatus;

const STATUS_FILTERS: StatusFilter[] = ['', ...MERCH_PAYMENT_STATUSES];

function OrderCard({ order, lang }: { order: MerchOrder; lang: string }) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        navigate.merchOrder(order.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={`#${order.id}`}
    >
      <Card className="gap-2 p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
              #{order.id} · {order.customer_name || '—'}
            </AppText>
            {order.customer_email ? (
              <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
                {order.customer_email}
              </AppText>
            ) : null}
          </View>
          <View className="items-end">
            <AppText className="font-gilroy-bold text-[14px]">{money(order.total, order.currency)}</AppText>
            <AppText className="font-gilroy-medium text-[11px] text-muted">
              {formatDateTime(order.created_at, lang)}
            </AppText>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <StatusBadge label={order.payment_status} color={paymentColor(order.payment_status)} />
          <StatusBadge label={order.fulfillment_status} color={fulfillmentColor(order.fulfillment_status)} />
          {order.invoice_serial ? (
            <AppText className="font-gilroy-medium text-[12px] text-muted">{order.invoice_serial}</AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export default function MerchOrdersScreen() {
  const { t, i18n } = useTranslation();
  const padding = useScreenPadding();
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const { eventId } = useSelectedEvent();
  const [status, setStatus] = useState<StatusFilter>('');
  const [refreshing, setRefreshing] = useState(false);
  const { busyKey, run } = useFileAction();
  const ordersQuery = useGetMerchOrdersByStatusQuery({ eventId: eventId ?? 0, status }, { skip: eventId == null });
  const orders = ordersQuery.data ?? [];

  const exportOrders = () => {
    if (eventId == null) return;
    void run(
      'export',
      (token) =>
        downloadAuthedFile(
          organizerTicketEndpoint.merchOrdersExport(eventId),
          token,
          `Merch Orders - Event ${eventId}.xlsx`,
        ),
      { ...XLSX_SHARE, dialogTitle: t('Export Excel') },
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await ordersQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderList = () => {
    if (ordersQuery.isLoading || (ordersQuery.isFetching && !refreshing)) return <ListSkeleton />;
    if (ordersQuery.isError) {
      return (
        <EmptyState
          icon={ShoppingBag}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void ordersQuery.refetch()}
        />
      );
    }
    if (orders.length === 0) {
      return (
        <EmptyState
          icon={ShoppingBag}
          title={t('No orders yet.')}
          message={
            status
              ? t('No orders match this filter.')
              : t('Orders will appear here once a customer completes checkout in your store.')
          }
        />
      );
    }
    return (
      <View className="gap-2.5">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} lang={i18n.language} />
        ))}
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Merch Store')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <MerchNav active="orders" />
          <SecondaryButton
            label={busyKey === 'export' ? t('Exporting...') : t('Export Excel')}
            onPress={exportOrders}
            loading={busyKey === 'export'}
            icon={<FileSpreadsheet size={16} color={iconTint} />}
          />
          <View className="flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((value) => (
              <Chip
                key={value || 'all'}
                label={value || t('All')}
                selected={status === value}
                onPress={() => setStatus(value)}
              />
            ))}
          </View>
          {renderList()}
        </View>
      </ScrollView>
    </Screen>
  );
}
