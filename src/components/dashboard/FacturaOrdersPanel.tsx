import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Download, FileCode, FileSpreadsheet, FileText, Pencil, X } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale, ToastHost } from '@/components/ui';
import {
  ACCENT_GREEN,
  ACCENT_ORANGE,
  ACCENT_RED,
  Avatar,
  FooterCount,
  ListSkeleton,
  PDF_SHARE,
  PanelCard,
  PanelError,
  PanelMessage,
  Pill,
  RowDivider,
  SearchField,
  SectionTitle,
  SmallAction,
  XLSX_SHARE,
  XML_SHARE,
  formatDateTimeLabel,
  matchesQuery,
  moneyLabel,
  personName,
  ticketSummary,
  useFileAction,
} from '@/components/dashboard/dashboardParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { downloadAuthedFile, type ShareFileOptions } from '@/lib/downloads';
import { haptics } from '@/lib/haptics';
import {
  SERIAL_EDITABLE_EVENT_ID,
  facturaDownloadEndpoint,
  useEditInvoiceSerialMutation,
  useGetFacturaIndividualOrdersQuery,
  useGetFacturaOrdersQuery,
  type FacturaOrder,
} from '@/store/api/facturaApi';
import { colors } from '@/theme/colors';

export type FacturaTab = 'bank_transfers' | 'persoane_juridice' | 'persoane_fizice';

const SPV_DEADLINE_DAYS = 5;
const SPV_URGENT_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

type DownloadKind = 'pdf' | 'xml' | 'sagaXml' | 'xlsx';

const DOWNLOADS: {
  kind: DownloadKind;
  label: string;
  short: string;
  icon: typeof FileText;
  share: ShareFileOptions;
  extension: string;
  prefix: string;
}[] = [
  {
    kind: 'pdf',
    label: 'Download PDF',
    short: 'PDF',
    icon: FileText,
    share: PDF_SHARE,
    extension: 'pdf',
    prefix: 'Factura',
  },
  {
    kind: 'xml',
    label: 'Download SPV',
    short: 'SPV',
    icon: FileCode,
    share: XML_SHARE,
    extension: 'xml',
    prefix: 'Factura',
  },
  {
    kind: 'sagaXml',
    label: 'Download SmartBill/Oblio',
    short: 'SmartBill/Oblio',
    icon: FileCode,
    share: XML_SHARE,
    extension: 'xml',
    prefix: 'Factura_SAGA',
  },
  {
    kind: 'xlsx',
    label: 'Download FGO',
    short: 'FGO',
    icon: FileSpreadsheet,
    share: XLSX_SHARE,
    extension: 'xlsx',
    prefix: 'Factura',
  },
];

const DOWNLOAD_ERRORS: Record<DownloadKind, string> = {
  pdf: 'Failed to download factura',
  xml: 'Failed to download factura XML',
  sagaXml: 'Failed to download factura SAGA XML',
  xlsx: 'Failed to download factura XLSX',
};

export function spvStatus(
  orderDate: string | null | undefined,
  downloaded: boolean,
  t: (key: string) => string,
  now = new Date(),
): { label: string; color: string } {
  if (downloaded) return { label: t('Downloaded'), color: ACCENT_GREEN };
  const order = orderDate ? new Date(orderDate) : null;
  if (!order || Number.isNaN(order.getTime())) return { label: '-', color: colors.muted };
  const deadline = order.getTime() + SPV_DEADLINE_DAYS * DAY_MS;
  const daysLeft = Math.ceil((deadline - now.getTime()) / DAY_MS);
  if (daysLeft <= 0) {
    const overdueBy = Math.abs(daysLeft);
    if (overdueBy === 0) return { label: t('Due today'), color: ACCENT_RED };
    return {
      label: `${t('Overdue')} ${overdueBy} ${overdueBy === 1 ? t('day') : t('days')}`,
      color: ACCENT_RED,
    };
  }
  const color = daysLeft <= SPV_URGENT_DAYS ? ACCENT_ORANGE : colors.primaryLight;
  return {
    label: daysLeft === 1 ? `1 ${t('day left')}` : `${daysLeft} ${t('days left')}`,
    color,
  };
}

function fileStem(order: FacturaOrder): string {
  const name = `${order.user?.first_name ?? ''} ${order.user?.last_name ?? ''}`.trim() || order.user?.email || 'Customer';
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_');
}

function SerialEditSheet({ order, onClose }: { order: FacturaOrder; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const submitTint = useThemeColor(colors.white, colors.primary);
  const [value, setValue] = useState(order.invoice_serial_number != null ? String(order.invoice_serial_number) : '');
  const [editSerial, { isLoading }] = useEditInvoiceSerialMutation();
  const prefix = order.invoice_serial_prefix ?? '';

  const onSubmit = useCallback(async () => {
    const trimmed = value.trim();
    const number = Number.parseInt(trimmed, 10);
    if (!/^\d+$/.test(trimmed) || number <= 0) {
      toast(t('Enter a valid serial number'), 'error');
      return;
    }
    try {
      await editSerial({ orderId: order.id, invoiceSerialNumber: number }).unwrap();
      toast(t('Serial number updated'), 'success');
      onClose();
    } catch {
      toast(t('Failed to update serial number'), 'error');
    }
  }, [value, editSerial, order.id, toast, t, onClose]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-gilroy-bold text-[20px]">{t('Edit serial number')}</AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <AppText className="mb-3 font-gilroy-medium text-[13px] text-muted">
              {`${t('No.')} ${order.invoice_serial || '-'}`}
            </AppText>
            <View className="flex-row items-center gap-2">
              {prefix ? <AppText className="font-gilroy-semibold text-[15px]">{`${prefix}-`}</AppText> : null}
              <View className="flex-1">
                <GlassInput
                  placeholder={t('Serial number')}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <PressableScale
              onPress={() => {
                void haptics.selection();
                void onSubmit();
              }}
              disabled={isLoading}
              accessibilityLabel={t('Save')}
              className="mt-5 h-[52px] w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white"
            >
              {isLoading ? (
                <ActivityIndicator color={submitTint} />
              ) : (
                <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">{t('Save')}</AppText>
              )}
            </PressableScale>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}

function FacturaRow({
  order,
  currency,
  downloaded,
  busyKey,
  onDownload,
  onEditSerial,
}: {
  order: FacturaOrder;
  currency: string;
  downloaded: boolean;
  busyKey: string | null;
  onDownload: (kind: DownloadKind) => void;
  onEditSerial?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const pencilTint = useThemeColor(colors.primary, colors.dark.text);
  const name = personName(order.user, t('Unknown'));
  const tickets = ticketSummary(order.tickets);
  const spv = spvStatus(order.order_date, downloaded, t);
  return (
    <View className="gap-2 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} />
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
      <View className="gap-1.5 pl-[52px]">
        <View className="flex-row items-center gap-1.5">
          <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[12px] text-muted">
            {`${t('No.')} ${order.invoice_serial || '-'} · #${order.id}`}
          </AppText>
          {onEditSerial ? (
            <PressableScale
              onPress={() => {
                void haptics.selection();
                onEditSerial();
              }}
              accessibilityLabel={t('Edit serial number')}
              className="h-7 w-7 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
            >
              <Pencil size={12} color={pencilTint} />
            </PressableScale>
          ) : null}
        </View>
        {tickets ? (
          <AppText numberOfLines={2} className="font-gilroy-medium text-[12px] text-muted">
            {tickets}
          </AppText>
        ) : null}
        <View className="flex-row flex-wrap items-center gap-1.5">
          {order.payment_method ? <Pill label={order.payment_method} color={colors.primaryLight} /> : null}
          {order.payment_status ? <Pill label={order.payment_status} color={ACCENT_GREEN} /> : null}
          <Pill label={`${t('SPV')}: ${spv.label}`} color={spv.color} />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2 pl-[52px]">
        <AppText className="font-gilroy-semibold text-[12px] text-muted">{t('Factura')}</AppText>
        {DOWNLOADS.map((download) => {
          const key = `${order.id}-${download.kind}`;
          return (
            <SmallAction
              key={download.kind}
              icon={Download}
              label={download.short}
              accessibilityLabel={busyKey === key ? t('Downloading...') : t(download.label)}
              onPress={() => onDownload(download.kind)}
              loading={busyKey === key}
            />
          );
        })}
      </View>
    </View>
  );
}

export function FacturaOrdersPanel({
  eventId,
  currency,
  isCancelled,
  tab,
  refreshSignal,
}: {
  eventId: number;
  currency: string;
  isCancelled: boolean;
  tab: FacturaTab;
  refreshSignal: number;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(() => new Set());
  const [editingOrder, setEditingOrder] = useState<FacturaOrder | null>(null);
  const { busyKey, run } = useFileAction();
  const isBank = tab === 'bank_transfers';
  const customerType = tab === 'persoane_juridice' ? 'juridice' : tab === 'persoane_fizice' ? 'fizice' : 'all';
  const bank = useGetFacturaOrdersQuery(
    { eventId, customerType },
    { skip: isCancelled || !isBank, refetchOnMountOrArgChange: true },
  );
  const individual = useGetFacturaIndividualOrdersQuery(
    { eventId, customerType },
    { skip: isCancelled || isBank, refetchOnMountOrArgChange: true },
  );
  const query = isBank ? bank : individual;
  const canEditSerial = tab === 'persoane_juridice' && eventId === SERIAL_EDITABLE_EVENT_ID;
  const { refetch } = query;

  useEffect(() => {
    if (refreshSignal > 0 && !isCancelled) void refetch();
  }, [refreshSignal, isCancelled, refetch]);

  const copy: Record<FacturaTab, { title: string; subtitle: string; footer: string }> = {
    bank_transfers: {
      title: t('Bank transfers'),
      subtitle: t('Bank transfer orders with invoice sent'),
      footer: t('Total bank transfer invoices sent'),
    },
    persoane_juridice: {
      title: t('Persoane juridice (Online payment)'),
      subtitle: t('Online paid orders from legal entities'),
      footer: t('Total online facturi sent'),
    },
    persoane_fizice: {
      title: t('Persoane fizice (Online payment)'),
      subtitle: t('Online paid orders from individuals'),
      footer: t('Total online facturi sent'),
    },
  };

  const orders = query.data ?? [];
  const filtered = orders.filter((order) =>
    matchesQuery(search, [personName(order.user, t('Unknown')), order.user?.email, order.id]),
  );

  const onDownload = async (order: FacturaOrder, kind: DownloadKind) => {
    const download = DOWNLOADS.find((item) => item.kind === kind);
    if (!download) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = isBank ? download.prefix : download.prefix.replace('Factura', 'Factura_Individual');
    const ok = await run(
      `${order.id}-${kind}`,
      (token) =>
        downloadAuthedFile(
          facturaDownloadEndpoint[kind](order.id),
          token,
          `${prefix}_${fileStem(order)}_Order_${order.id}_${stamp}.${download.extension}`,
        ),
      { ...download.share, dialogTitle: t('Factura') },
      { error: t(DOWNLOAD_ERRORS[kind]) },
    );
    if (ok) setDownloadedIds((current) => new Set(current).add(order.id));
  };

  return (
    <View className="gap-3">
      <SectionTitle subtitle={copy[tab].subtitle}>{copy[tab].title}</SectionTitle>
      <SearchField value={search} onChange={setSearch} placeholder={t('Search by name or email...')} />
      {query.isError && !query.data ? (
        <PanelError onRetry={() => void refetch()} />
      ) : query.isLoading || (query.isFetching && !query.data) ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <PanelMessage text={search.trim() ? t('No results match your search') : t('No orders to show here yet.')} />
      ) : (
        <PanelCard>
          {filtered.map((order, index) => (
            <RowDivider key={order.id} index={index}>
              <FacturaRow
                order={order}
                currency={currency}
                downloaded={Boolean(order.factura_downloaded) || downloadedIds.has(order.id)}
                busyKey={busyKey}
                onDownload={(kind) => void onDownload(order, kind)}
                onEditSerial={canEditSerial ? () => setEditingOrder(order) : undefined}
              />
            </RowDivider>
          ))}
        </PanelCard>
      )}
      {orders.length > 0 ? <FooterCount label={copy[tab].footer} count={orders.length} /> : null}
      {editingOrder ? (
        <SerialEditSheet key={editingOrder.id} order={editingOrder} onClose={() => setEditingOrder(null)} />
      ) : null}
    </View>
  );
}
