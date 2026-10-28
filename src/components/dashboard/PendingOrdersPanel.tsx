import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import {
  ACCENT_GREEN,
  Avatar,
  FooterCount,
  ListSkeleton,
  PanelCard,
  PanelError,
  PanelMessage,
  Pill,
  RowDivider,
  SearchField,
  SectionTitle,
  SmallAction,
  confirmAction,
  formatDateTimeLabel,
  matchesQuery,
  moneyLabel,
  personName,
  ticketSummary,
} from '@/components/dashboard/dashboardParts';
import { useToast } from '@/hooks/useToast';
import { haptics } from '@/lib/haptics';
import { useGetPendingOrdersQuery, useMarkInvoiceAsPaidMutation, type PendingOrder } from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

function PendingOrderRow({
  order,
  currency,
  marking,
  onMarkAsPaid,
}: {
  order: PendingOrder;
  currency: string;
  marking: boolean;
  onMarkAsPaid: () => void;
}) {
  const { t, i18n } = useTranslation();
  const name = personName(order.user, t('Unknown'));
  const tickets = ticketSummary(order.tickets);
  return (
    <View className="gap-2 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} image={order.user?.profile_image} />
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {name}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
            {order.user?.email || '-'}
          </AppText>
        </View>
        <View className="items-end">
          <AppText className="font-gilroy-bold text-[14px]">{moneyLabel(order.total_price, currency)}</AppText>
          <AppText className="font-gilroy-medium text-[11px] text-muted">
            {formatDateTimeLabel(order.order_date, i18n.language)}
          </AppText>
        </View>
      </View>
      {tickets ? (
        <AppText numberOfLines={2} className="pl-[52px] font-gilroy-medium text-[12px] text-muted">
          {tickets}
        </AppText>
      ) : null}
      <View className="flex-row items-center justify-between gap-2 pl-[52px]">
        <View className="flex-row items-center gap-1.5">
          <AppText className="font-gilroy-semibold text-[12px] text-muted">{`#${order.id}`}</AppText>
          {order.payment_method ? <Pill label={order.payment_method} color={colors.primaryLight} /> : null}
        </View>
        {order.payment_method === 'INVOICE' ? (
          <SmallAction
            icon={Check}
            label={marking ? t('Processing...') : t('Mark as Paid')}
            onPress={onMarkAsPaid}
            loading={marking}
            color={ACCENT_GREEN}
          />
        ) : null}
      </View>
    </View>
  );
}

export function PendingOrdersPanel({
  eventId,
  currency,
  isCancelled,
  refreshSignal,
}: {
  eventId: number;
  currency: string;
  isCancelled: boolean;
  refreshSignal: number;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [markingId, setMarkingId] = useState<number | null>(null);
  const query = useGetPendingOrdersQuery(eventId, {
    skip: isCancelled,
    refetchOnMountOrArgChange: true,
  });
  const { refetch } = query;
  const [markInvoiceAsPaid] = useMarkInvoiceAsPaidMutation();

  useEffect(() => {
    if (refreshSignal > 0 && !isCancelled) void refetch();
  }, [refreshSignal, isCancelled, refetch]);

  const orders = query.data ?? [];
  const filtered = orders.filter((order) =>
    matchesQuery(search, [personName(order.user, t('Unknown')), order.user?.email, order.id]),
  );

  const markAsPaid = async (orderId: number) => {
    setMarkingId(orderId);
    try {
      const result = await markInvoiceAsPaid(orderId).unwrap();
      void haptics.success();
      toast(
        result.factura_sent
          ? t('Order marked as paid. The tickets and the factura were sent to the buyer.')
          : t('Order marked as paid and tickets sent to the buyer.'),
        'success',
      );
      void refetch();
    } catch {
      toast(t('Failed to mark order as paid. Please try again.'), 'error');
    } finally {
      setMarkingId(null);
    }
  };

  const onMarkAsPaid = (orderId: number) =>
    confirmAction({
      title: t('Mark as Paid'),
      message: t(
        'Are you sure you want to mark this invoice order as paid? This will send the tickets and the factura to the buyer.',
      ),
      confirmLabel: t('Mark as Paid'),
      cancelLabel: t('Cancel'),
      onConfirm: () => void markAsPaid(orderId),
    });

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('Users who initiated checkout but have not completed payment')}>
        {t('Pending orders')}
      </SectionTitle>
      <SearchField value={search} onChange={setSearch} placeholder={t('Search by name or email...')} />
      {query.isError && !query.data ? (
        <PanelError onRetry={() => void refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <PanelMessage text={search.trim() ? t('No results match your search') : t('No pending orders for this event yet.')} />
      ) : (
        <PanelCard>
          {filtered.map((order, index) => (
            <RowDivider key={order.id} index={index}>
              <PendingOrderRow
                order={order}
                currency={currency}
                marking={markingId === order.id}
                onMarkAsPaid={() => onMarkAsPaid(order.id)}
              />
            </RowDivider>
          ))}
        </PanelCard>
      )}
      {orders.length > 0 ? <FooterCount label={t('Total pending orders')} count={orders.length} /> : null}
    </View>
  );
}
