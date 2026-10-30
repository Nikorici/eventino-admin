import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, RotateCcw, ShoppingBag, Truck } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, Screen, Skeleton } from '@/components/ui';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import { FacturaActions } from '@/components/merch/FacturaActions';
import {
  Card,
  DangerButton,
  InfoRow,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  StatusBadge,
  formatDateTime,
  fulfillmentColor,
  money,
  paymentColor,
} from '@/components/merch/merchParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useGetMerchOrderQuery,
  useRefundMerchOrderMutation,
  useUpdateMerchFulfillmentMutation,
  type MerchFulfillmentStatus,
  type MerchOrder,
} from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

function OrderBody({ order, lang }: { order: MerchOrder; lang: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const primaryTint = useThemeColor(colors.white, colors.primary);
  const secondaryTint = useThemeColor(colors.primary, colors.dark.text);
  const [updateFulfillment, { isLoading: updating }] = useUpdateMerchFulfillmentMutation();
  const [refundOrder, { isLoading: refunding }] = useRefundMerchOrderMutation();
  const [pendingStatus, setPendingStatus] = useState<MerchFulfillmentStatus | null>(null);
  const address = order.shipping_address;
  const busy = updating || refunding;
  const hasFactura = order.payment_status === 'PAID' || order.payment_status === 'REFUNDED';

  const setStatus = async (status: MerchFulfillmentStatus, successMessage: string) => {
    haptics.selection();
    setPendingStatus(status);
    try {
      await updateFulfillment({ orderId: order.id, fulfillment_status: status }).unwrap();
      toast(successMessage, 'success');
    } catch {
      toast(t('Failed to update order'), 'error');
    } finally {
      setPendingStatus(null);
    }
  };

  const refund = async () => {
    try {
      await refundOrder(order.id).unwrap();
      toast(t('Order refunded'), 'success');
    } catch {
      toast(t('Refund failed'), 'error');
    }
  };

  const onRefund = () => {
    haptics.medium();
    confirmAction({
      title: t('Refund this order?'),
      message: t('This action cannot be undone.'),
      confirmLabel: t('Refund'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: () => void refund(),
    });
  };

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center gap-1.5">
        <StatusBadge label={order.payment_status} color={paymentColor(order.payment_status)} />
        <StatusBadge label={order.fulfillment_status} color={fulfillmentColor(order.fulfillment_status)} />
        <AppText className="font-gilroy-medium text-[12px] text-muted">{formatDateTime(order.created_at, lang)}</AppText>
      </View>

      <View className="gap-2">
        <SectionLabel>{t('Items')}</SectionLabel>
        <Card className="px-4">
          {order.items.map((item, index) => (
            <View
              key={item.id}
              className={cn('flex-row items-center justify-between gap-3 py-3', index > 0 && 'border-t')}
              style={index > 0 ? { borderColor: rowDivider } : undefined}
            >
              <AppText numberOfLines={2} className="flex-1 font-gilroy-medium text-[13px]">
                {item.product_name_snapshot}
                {item.variant_name_snapshot ? ` — ${item.variant_name_snapshot}` : ''} × {item.quantity}
              </AppText>
              <AppText className="font-gilroy-semibold text-[13px]">{money(item.line_total, order.currency)}</AppText>
            </View>
          ))}
        </Card>
      </View>

      <Card className="gap-1 p-4">
        <InfoRow label={t('Subtotal')} value={money(order.subtotal, order.currency)} />
        <InfoRow label={t('Shipping')} value={money(order.shipping_fee, order.currency)} />
        <View className="my-1 h-px" style={{ backgroundColor: rowDivider }} />
        <View className="flex-row items-center justify-between">
          <AppText className="font-gilroy-bold text-[15px]">{t('Total')}</AppText>
          <AppText className="font-gilroy-bold text-[15px]">{money(order.total, order.currency)}</AppText>
        </View>
      </Card>

      <Card className="gap-0.5 p-4">
        <View className="mb-1">
          <SectionLabel>{t('Customer')}</SectionLabel>
        </View>
        <InfoRow label={t('Name')} value={order.customer_name || '—'} />
        <InfoRow label={t('Email')} value={order.customer_email || '—'} />
        <InfoRow label={t('Phone')} value={order.customer_phone || '—'} />
      </Card>

      <Card className="gap-0.5 p-4">
        <View className="mb-1">
          <SectionLabel>{t('Shipping address')}</SectionLabel>
        </View>
        {address ? (
          <AppText className="font-gilroy-medium text-[13px]">
            {[
              address.recipient_name,
              address.street,
              [[address.city, address.region].filter(Boolean).join(', '), address.postal_code].filter(Boolean).join(' '),
              address.country,
              address.phone,
            ]
              .filter(Boolean)
              .join('\n')}
          </AppText>
        ) : (
          <AppText className="font-gilroy-medium text-[13px] text-muted">—</AppText>
        )}
      </Card>

      <Card className="gap-0.5 p-4">
        <View className="mb-1">
          <SectionLabel>{t('Payment & timeline')}</SectionLabel>
        </View>
        <InfoRow label={t('Order ID')} value={String(order.id)} />
        <InfoRow label={t('Reference')} value={order.order_number} />
        <InfoRow label={t('Invoice serial')} value={order.invoice_serial || '—'} />
        <InfoRow label={t('Payment method')} value={order.payment_method || '—'} />
        <InfoRow label={t('Created')} value={formatDateTime(order.created_at, lang)} />
        {order.shipped_at ? <InfoRow label={t('Shipped')} value={formatDateTime(order.shipped_at, lang)} /> : null}
        {order.delivered_at ? (
          <InfoRow label={t('Delivered')} value={formatDateTime(order.delivered_at, lang)} />
        ) : null}
      </Card>

      {hasFactura ? (
        <Card className="gap-2.5 p-4">
          <SectionLabel>{t('Factura')}</SectionLabel>
          {order.invoice_serial ? (
            <AppText className="font-gilroy-semibold text-[13px]">{order.invoice_serial}</AppText>
          ) : null}
          <FacturaActions order={order} />
        </Card>
      ) : null}

      {order.payment_status === 'PAID' ? (
        <View className="gap-2.5">
          <SectionLabel>{t('Fulfillment')}</SectionLabel>
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <PrimaryButton
                compact
                label={t('Mark Shipped')}
                onPress={() => void setStatus('SHIPPED', t('Order marked as shipped'))}
                loading={pendingStatus === 'SHIPPED'}
                disabled={busy}
                icon={<Truck size={16} color={primaryTint} />}
              />
            </View>
            <View className="flex-1">
              <SecondaryButton
                label={t('Mark Delivered')}
                onPress={() => void setStatus('DELIVERED', t('Order marked as delivered'))}
                loading={pendingStatus === 'DELIVERED'}
                disabled={busy}
                icon={<Check size={16} color={secondaryTint} />}
              />
            </View>
          </View>
          <DangerButton
            label={t('Refund')}
            onPress={onRefund}
            loading={refunding}
            disabled={busy}
            icon={<RotateCcw size={16} color={colors.danger} />}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function MerchOrderScreen() {
  const { t, i18n } = useTranslation();
  const padding = useScreenPadding();
  const { oid } = useLocalSearchParams<{ oid: string }>();
  const orderId = Number(oid);
  const orderQuery = useGetMerchOrderQuery(orderId, { skip: !orderId });
  const [refreshing, setRefreshing] = useState(false);
  const order = orderQuery.data;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await orderQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (orderQuery.isLoading) {
      return (
        <View className="gap-3">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-28 w-full rounded-[12px]" />
          <Skeleton className="h-24 w-full rounded-[12px]" />
          <Skeleton className="h-28 w-full rounded-[12px]" />
        </View>
      );
    }
    if (orderQuery.isError || !order) {
      return (
        <EmptyState
          icon={ShoppingBag}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void orderQuery.refetch()}
        />
      );
    }
    return <OrderBody order={order} lang={i18n.language} />;
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Order #{{number}}', { number: oid })} onBack={navigate.back} />
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
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}
