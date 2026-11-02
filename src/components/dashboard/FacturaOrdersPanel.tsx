import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronUp, Download, Ellipsis, FileCode, FileCodeCorner, FileSpreadsheet, FileText, Pencil, Ticket } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { SheetModal } from '@/components/merch/merchParts';
import {
  ACCENT_GREEN,
  ACCENT_ORANGE,
  ACCENT_RED,
  ListSkeleton,
  PDF_SHARE,
  PanelError,
  PanelMessage,
  Pill,
  SearchField,
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
    <SheetModal
      visible
      onClose={onClose}
      title={t('Edit serial number')}
      footer={
        <PressableScale
          onPress={() => {
            void haptics.selection();
            void onSubmit();
          }}
          disabled={isLoading}
          accessibilityLabel={t('Save')}
          className="h-[52px] w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white"
        >
          {isLoading ? (
            <ActivityIndicator color={submitTint} />
          ) : (
            <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">{t('Save')}</AppText>
          )}
        </PressableScale>
      }
    >
      <AppText className="mb-3 font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
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
    </SheetModal>
  );
}

function RoundIconAction({
  icon: Icon,
  label,
  loading,
  onPress,
}: {
  icon: typeof FileText;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const tint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <PressableScale
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      disabled={loading}
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
    >
      {loading ? <ActivityIndicator size="small" color={tint} /> : <Icon size={16} color={tint} />}
    </PressableScale>
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
  const [expanded, setExpanded] = useState(false);
  const pencilTint = useThemeColor(colors.primary, colors.dark.text);
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const divider = useThemeColor('#f0f2f8', colors.dark.border);
  const name = personName(order.user, t('Unknown'));
  const tickets = ticketSummary(order.tickets);
  const ticketCount = order.tickets?.length ?? 0;
  const spv = spvStatus(order.order_date, downloaded, t);
  const meta = [`${t('No.')} ${order.invoice_serial || '-'}`, order.payment_method, ticketCount > 0 ? `${ticketCount} ×` : null]
    .filter(Boolean)
    .join(' · ');
  const busyLabel = (kind: DownloadKind, label: string) =>
    busyKey === `${order.id}-${kind}` ? t('Downloading...') : t(label);
  const [pdf, spvXml, ...extraDownloads] = DOWNLOADS;
  return (
    <View className="gap-2 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {name}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {order.user?.email || '-'}
          </AppText>
          {order.user?.company_name ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
              {order.user.company_name}
            </AppText>
          ) : null}
        </View>
        <View className="items-end">
          <AppText className="font-gilroy-bold text-[14px]">{moneyLabel(order.total_price, currency)}</AppText>
          <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
            {formatDateTimeLabel(order.order_date, i18n.language)}
          </AppText>
          <AppText className="font-gilroy-semibold text-[11px]" style={{ color: spv.color }}>
            {`${t('SPV')}: ${spv.label}`}
          </AppText>
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-1 overflow-hidden">
          <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {meta}
          </AppText>
          {ticketCount > 0 ? <Ticket size={12} color={colors.muted} /> : null}
          {onEditSerial ? (
            <PressableScale
              onPress={() => {
                void haptics.selection();
                onEditSerial();
              }}
              accessibilityLabel={t('Edit serial number')}
              className="ml-1 h-7 w-7 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
            >
              <Pencil size={12} color={pencilTint} />
            </PressableScale>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          {pdf ? (
            <RoundIconAction
              icon={FileText}
              label={busyLabel(pdf.kind, pdf.label)}
              loading={busyKey === `${order.id}-${pdf.kind}`}
              onPress={() => onDownload(pdf.kind)}
            />
          ) : null}
          {spvXml ? (
            <RoundIconAction
              icon={FileCodeCorner}
              label={busyLabel(spvXml.kind, spvXml.label)}
              loading={busyKey === `${order.id}-${spvXml.kind}`}
              onPress={() => onDownload(spvXml.kind)}
            />
          ) : null}
          <RoundIconAction icon={expanded ? ChevronUp : Ellipsis} label={t('More')} onPress={() => setExpanded((open) => !open)} />
        </View>
      </View>
      {expanded ? (
        <View className="gap-2 border-t pt-2" style={{ borderColor: divider }}>
          {tickets ? (
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{tickets}</AppText>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-1.5">
            <AppText className="font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{`#${order.id}`}</AppText>
            {order.payment_status ? <Pill label={order.payment_status} color={ACCENT_GREEN} /> : null}
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            {extraDownloads.map((download) => (
              <SmallAction
                key={download.kind}
                icon={Download}
                label={download.short}
                accessibilityLabel={busyLabel(download.kind, download.label)}
                onPress={() => onDownload(download.kind)}
                loading={busyKey === `${order.id}-${download.kind}`}
              />
            ))}
          </View>
        </View>
      ) : null}
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
      <SearchField value={search} onChange={setSearch} placeholder={t('Search by name or email...')} />
      {orders.length > 0 ? (
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{`${t('Total')}: ${orders.length}`}</AppText>
      ) : null}
      {query.isError && !query.data ? (
        <PanelError onRetry={() => void refetch()} />
      ) : query.isLoading || (query.isFetching && !query.data) ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <PanelMessage text={search.trim() ? t('No results match your search') : t('No orders to show here yet.')} />
      ) : (
        <View className="gap-2.5">
          {filtered.map((order) => (
            <FacturaRow
              key={order.id}
              order={order}
              currency={currency}
              downloaded={Boolean(order.factura_downloaded) || downloadedIds.has(order.id)}
              busyKey={busyKey}
              onDownload={(kind) => void onDownload(order, kind)}
              onEditSerial={canEditSerial ? () => setEditingOrder(order) : undefined}
            />
          ))}
        </View>
      )}
      {editingOrder ? (
        <SerialEditSheet key={editingOrder.id} order={editingOrder} onClose={() => setEditingOrder(null)} />
      ) : null}
    </View>
  );
}
