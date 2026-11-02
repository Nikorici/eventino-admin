import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Armchair, Link2, Pencil, Plus, X } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, GlassInput, PressableScale, Screen } from '@/components/ui';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import {
  OfferActionButton,
  OfferCard,
  OfferFormSheet,
  OffersSkeleton,
  copyOfferLink,
  type OfferTone,
} from '@/components/offers/offerParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { formatSaleMoment } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { formatMoney } from '@/lib/pricing';
import {
  useCancelTableMutation,
  useCreateTableMutation,
  useGetEventTablesQuery,
  useUpdateTableMutation,
  type TableOffer,
  type TablePaymentStatus,
} from '@/store/api/privateOffersApi';
import { colors } from '@/theme/colors';

const STATUS_TONES: Record<TablePaymentStatus, OfferTone> = {
  PAID: 'success',
  PENDING: 'warning',
  CANCELLED: 'danger',
};

interface TableForm {
  name: string;
  price: string;
  payerName: string;
}

const emptyForm: TableForm = { name: '', price: '', payerName: '' };

function TableFormSheet({
  eventId,
  table,
  onClose,
}: {
  eventId: number;
  table: TableOffer | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState<TableForm>(() =>
    table ? { name: table.name, price: table.price, payerName: table.payer_name || '' } : emptyForm,
  );
  const [createTable, { isLoading: creating }] = useCreateTableMutation();
  const [updateTable, { isLoading: updating }] = useUpdateTableMutation();

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('Table name is required'), 'error');
    const price = Number(form.price);
    if (!price || price <= 0) return toast(t('Enter a price greater than zero'), 'error');
    const body = { name: form.name.trim(), price: price.toFixed(2), payer_name: form.payerName.trim() };
    try {
      if (table) await updateTable({ tableId: table.id, eventId, body }).unwrap();
      else await createTable({ ...body, event: eventId }).unwrap();
      haptics.success();
      toast(table ? t('Table updated.') : t('Table created. Copy its link and send it to the client.'), 'success');
      onClose();
    } catch (error) {
      haptics.error();
      const message = extractApiError(error);
      toast(message ? t(message) : t('Something went wrong.'), 'error');
    }
  };

  return (
    <OfferFormSheet
      title={table ? t('Edit table') : t('New table')}
      submitLabel={table ? t('Save') : t('Create table')}
      saving={creating || updating}
      onSubmit={() => void handleSave()}
      onClose={onClose}
    >
      <GlassInput label={t('Table name')} maxLength={100} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <GlassInput
        label={t('Price')}
        value={form.price}
        onChangeText={(price) => setForm({ ...form, price: price.replace(/[^0-9.,]/g, '').replace(',', '.') })}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
        {t('This is the final price the client pays — VAT and platform fees included.')}
      </AppText>
      <GlassInput
        label={t('Payer name (optional)')}
        maxLength={200}
        value={form.payerName}
        onChangeText={(payerName) => setForm({ ...form, payerName })}
      />
    </OfferFormSheet>
  );
}

export default function TablesScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const onPrimary = useThemeColor(colors.white, colors.primary);
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const tablesQuery = useGetEventTablesQuery(eventId ?? 0, { skip: eventId == null });
  const [cancelTable] = useCancelTableMutation();
  const [sheet, setSheet] = useState<{ table: TableOffer | null } | null>(null);
  const [busyTableId, setBusyTableId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data]);

  const statusLabels: Record<TablePaymentStatus, string> = {
    PAID: t('Paid'),
    PENDING: t('Pending'),
    CANCELLED: t('Cancelled'),
  };

  const copyLink = async (table: TableOffer) => {
    await copyOfferLink(table.token);
    toast(t('Payment link copied'), 'success');
  };

  const confirmCancel = (table: TableOffer) => {
    if (eventId == null) return;
    confirmAction({
      title: t('Cancel this table? Its payment link will stop working.'),
      cancelLabel: t('Keep table'),
      confirmLabel: t('Cancel table'),
      destructive: true,
      onConfirm: () => {
        setBusyTableId(table.id);
        cancelTable({ tableId: table.id, eventId })
          .unwrap()
          .catch((error: unknown) => {
            const message = extractApiError(error);
            toast(message ? t(message) : t('Something went wrong.'), 'error');
          })
          .finally(() => setBusyTableId(null));
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), tablesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderList = () => {
    if (tablesQuery.isLoading) return <OffersSkeleton />;
    if (tablesQuery.isError) {
      return (
        <EmptyState
          icon={Armchair}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void tablesQuery.refetch()}
        />
      );
    }
    if (tables.length === 0) return <EmptyState icon={Armchair} title={t('No tables yet.')} />;
    return (
      <View className="gap-3">
        {tables.map((table) => {
          const payment = table.payment;
          const paymentStatus = payment?.payment_status ?? 'PENDING';
          const busy = busyTableId === table.id;
          const paidBy = payment?.paid_by_name || payment?.paid_by_email;
          const paidAt = formatSaleMoment(payment?.paid_at, i18n.language);
          return (
            <OfferCard
              key={table.id}
              title={table.name}
              subtitle={table.payer_name || '—'}
              statusLabel={statusLabels[paymentStatus] ?? paymentStatus}
              tone={STATUS_TONES[paymentStatus] ?? 'neutral'}
              amount={`${formatMoney(Number(table.price) || 0)} ${table.currency}`}
              aside={
                paymentStatus === 'PAID' && (paidBy || paidAt) ? (
                  <>
                    {paidBy ? (
                      <AppText numberOfLines={1} className="font-gilroy-semibold text-[13px]">
                        {paidBy}
                      </AppText>
                    ) : null}
                    {paidAt ? (
                      <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{paidAt}</AppText>
                    ) : null}
                  </>
                ) : undefined
              }
              actions={
                paymentStatus === 'CANCELLED' ? undefined : (
                  <>
                    <OfferActionButton label={t('Copy link')} icon={Link2} onPress={() => void copyLink(table)} />
                    {paymentStatus === 'PENDING' ? (
                      <>
                        <OfferActionButton
                          label={t('Edit')}
                          icon={Pencil}
                          disabled={busy}
                          onPress={() => {
                            haptics.light();
                            setSheet({ table });
                          }}
                        />
                        <OfferActionButton label={t('Cancel')} icon={X} danger disabled={busy} onPress={() => confirmCancel(table)} />
                      </>
                    ) : null}
                  </>
                )
              }
            />
          );
        })}
      </View>
    );
  };

  const renderBody = () => {
    if (eventLoading) return <OffersSkeleton />;
    if (eventError || !event || eventId == null) {
      return (
        <EmptyState
          icon={Armchair}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    return (
      <View className="gap-4">
        <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">
          {t('Create a table, send its payment link to the client and see whether it was paid.')}
        </AppText>
        <PressableScale
          onPress={() => {
            haptics.light();
            setSheet({ table: null });
          }}
          accessibilityLabel={t('New table')}
          className="h-12 flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white"
        >
          <Plus size={18} color={onPrimary} />
          <AppText className="font-gilroy-semibold text-[15px] text-white dark:text-primary">{t('New table')}</AppText>
        </PressableScale>
        {renderList()}
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Tables')} onBack={navigate.back} />
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
      {sheet && eventId != null ? (
        <TableFormSheet eventId={eventId} table={sheet.table} onClose={() => setSheet(null)} />
      ) : null}
    </Screen>
  );
}
