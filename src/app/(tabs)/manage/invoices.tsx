import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileText, ReceiptText, Search, Send } from 'lucide-react-native';

import { AppText, Badge, Chip, EmptyState, GlassHeader, PressableScale, Screen, SegmentedControl, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { FacturaOrdersPanel, type FacturaTab } from '@/components/dashboard/FacturaOrdersPanel';
import {
  ListSkeleton,
  PDF_SHARE,
  SearchField,
  matchesQuery,
  moneyLabel,
  useFileAction,
} from '@/components/dashboard/dashboardParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { downloadAuthedFile } from '@/lib/downloads';
import { eventCurrencyCode } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  smartbillDownloadEndpoint,
  smartbillErrorMessage,
  useGetSmartBillInvoicesQuery,
  useSendSmartBillInvoiceMutation,
  type SmartBillInvoiceRow,
  type SmartBillInvoiceState,
} from '@/store/api/smartbillApi';
import { colors } from '@/theme/colors';

type InvoicesTab = 'smartbill' | 'factura';

const STATE_APPEARANCE: Record<SmartBillInvoiceState, { label: string; container: string; text: string }> = {
  sent: { label: 'Sent', container: 'bg-accent/15', text: 'text-accent dark:text-accent' },
  failed: { label: 'Failed', container: 'bg-danger/15', text: 'text-danger dark:text-danger' },
  cancelled: { label: 'Cancelled', container: 'bg-black/[0.06] dark:bg-white/10', text: 'text-muted dark:text-dark-muted' },
  pending: { label: 'Pending', container: 'bg-black/[0.06] dark:bg-white/10', text: 'text-muted dark:text-dark-muted' },
};

function invoiceNumber(row: SmartBillInvoiceRow): string {
  return `${row.series}${row.number}`.trim();
}

function InvoiceCard({ children }: { children: ReactNode }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      {children}
    </View>
  );
}

function InvoiceRow({
  row,
  sending,
  downloading,
  onSend,
  onOpenPdf,
}: {
  row: SmartBillInvoiceRow;
  sending: boolean;
  downloading: boolean;
  onSend: () => void;
  onOpenPdf: () => void;
}) {
  const { t } = useTranslation();
  const tint = useThemeColor(colors.primary, colors.dark.text);
  const appearance = STATE_APPEARANCE[row.state] ?? STATE_APPEARANCE.pending;
  const number = invoiceNumber(row);

  return (
    <InvoiceCard>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {row.customer || t('Guest')}
          </AppText>
          <View className="flex-row items-center gap-2">
            <Badge label={t(appearance.label)} className={appearance.container} textClassName={appearance.text} />
            {row.state === 'sent' && number ? (
              <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {number}
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText className="font-gilroy-bold text-[14px]">{moneyLabel(row.total, row.currency)}</AppText>
      </View>

      {row.state === 'failed' && row.error_message ? (
        <AppText numberOfLines={3} className="font-gilroy-medium text-[12px] text-danger dark:text-danger">
          {row.error_message}
        </AppText>
      ) : null}

      <View className="flex-row items-center justify-end">
        {row.state === 'sent' ? (
          <PressableScale
            onPress={onOpenPdf}
            disabled={downloading}
            accessibilityLabel={t('Open PDF')}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
          >
            {downloading ? <ActivityIndicator size="small" color={colors.muted} /> : <FileText size={16} color={tint} />}
          </PressableScale>
        ) : (
          <PressableScale
            onPress={onSend}
            disabled={sending}
            accessibilityLabel={t('Send to SmartBill')}
            className={cn(
              'h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-primary px-3.5 dark:border-white/30',
              sending && 'opacity-60',
            )}
          >
            {sending ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <>
                <Send size={14} color={tint} />
                <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-dark-text">
                  {t('Send to SmartBill')}
                </AppText>
              </>
            )}
          </PressableScale>
        )}
      </View>
    </InvoiceCard>
  );
}

function InvoiceRowSkeleton() {
  return (
    <InvoiceCard>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-24" />
        </View>
        <Skeleton className="h-3.5 w-16" />
      </View>
      <View className="flex-row justify-end">
        <Skeleton className="h-9 w-32 rounded-full" />
      </View>
    </InvoiceCard>
  );
}

function SmartBillInvoices({ eventId, refreshSignal }: { eventId: number; refreshSignal: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<number | null>(null);
  const query = useGetSmartBillInvoicesQuery(eventId);
  const [sendInvoice] = useSendSmartBillInvoiceMutation();
  const { busyKey, run } = useFileAction();
  const { refetch } = query;

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  const rows = query.data ?? [];
  const filtered = rows.filter((row) => matchesQuery(search, [row.customer, invoiceNumber(row), row.order_id]));

  const onSend = async (row: SmartBillInvoiceRow) => {
    if (sendingId != null) return;
    void haptics.selection();
    setSendingId(row.order_id);
    try {
      const result = await sendInvoice(row.order_id).unwrap();
      if (result.state === 'sent') toast(t('Invoice sent to SmartBill.'), 'success');
      else toast(t('Please try again.'), 'error');
    } catch (error) {
      toast(smartbillErrorMessage(error) ?? t('Failed to send invoice to SmartBill.'), 'error');
    } finally {
      setSendingId(null);
    }
  };

  const onOpenPdf = (row: SmartBillInvoiceRow) =>
    void run(
      String(row.order_id),
      (token) =>
        downloadAuthedFile(
          smartbillDownloadEndpoint.pdf(row.order_id),
          token,
          `SmartBill_${invoiceNumber(row).replace(/[^\w-]/g, '') || `Order_${row.order_id}`}.pdf`,
        ),
      { ...PDF_SHARE, dialogTitle: t('Open PDF') },
      { error: t('Failed to open invoice PDF.') },
    );

  const renderList = () => {
    if (query.isLoading || (query.isFetching && !query.data)) {
      return (
        <View className="gap-2.5">
          <InvoiceRowSkeleton />
          <InvoiceRowSkeleton />
          <InvoiceRowSkeleton />
        </View>
      );
    }
    if (query.isError && !query.data) {
      return (
        <EmptyState
          icon={ReceiptText}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void query.refetch()}
        />
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={ReceiptText}
          title={t('No orders yet.')}
          message={t('Paid orders will appear here so you can issue SmartBill invoices.')}
        />
      );
    }
    if (filtered.length === 0) return <EmptyState icon={Search} title={t('No results match your search')} />;
    return (
      <View className="gap-2.5">
        {filtered.map((row) => (
          <InvoiceRow
            key={row.order_id}
            row={row}
            sending={sendingId === row.order_id}
            downloading={busyKey === String(row.order_id)}
            onSend={() => void onSend(row)}
            onOpenPdf={() => onOpenPdf(row)}
          />
        ))}
      </View>
    );
  };

  return (
    <>
      <SearchField value={search} onChange={setSearch} placeholder={t('Search by name or invoice...')} />
      {rows.length > 0 ? (
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{`${t('Total')}: ${rows.length}`}</AppText>
      ) : null}
      {renderList()}
    </>
  );
}

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const [tab, setTab] = useState<InvoicesTab>('smartbill');
  const [facturaTab, setFacturaTab] = useState<FacturaTab>('bank_transfers');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const facturaTabs: { key: FacturaTab; label: string }[] = [
    { key: 'bank_transfers', label: t('Bank transfers') },
    { key: 'persoane_juridice', label: t('Persoane juridice') },
    { key: 'persoane_fizice', label: t('Persoane fizice') },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshSignal((current) => current + 1);
    try {
      await refetchEvent();
    } finally {
      setRefreshing(false);
    }
  };

  const renderFactura = () => {
    if (eventLoading) return <ListSkeleton />;
    if (eventError || !event || eventId == null) {
      return (
        <EmptyState
          icon={ReceiptText}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4 grow-0"
          contentContainerClassName="gap-2 px-4"
        >
          {facturaTabs.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={facturaTab === item.key}
              onPress={() => setFacturaTab(item.key)}
            />
          ))}
        </ScrollView>
        <FacturaOrdersPanel
          key={facturaTab}
          eventId={eventId}
          currency={eventCurrencyCode(event)}
          isCancelled={Boolean(event.is_cancelled)}
          tab={facturaTab}
          refreshSignal={refreshSignal}
        />
      </>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Ticket sales invoices')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <View className="gap-3">
          <SegmentedControl<InvoicesTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'smartbill', label: t('SmartBill') },
              { value: 'factura', label: t('Factura') },
            ]}
          />
          {tab === 'factura' ? (
            renderFactura()
          ) : eventId != null ? (
            <SmartBillInvoices eventId={eventId} refreshSignal={refreshSignal} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
