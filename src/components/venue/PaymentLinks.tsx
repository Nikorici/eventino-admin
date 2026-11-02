import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { addHours, format, isFuture, isValid, parse } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronDown } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { EventFormDateTimeField } from '@/components/events/EventFormDateTimeField';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { formatPrice } from '@/lib/seating/pricing';
import {
  useCancelPaymentLinkMutation,
  useCreatePaymentLinkMutation,
  useGetPaymentLinksQuery,
  type PaymentLinkStatus,
  type PaymentLinkTable,
  type TablePaymentLink,
} from '@/store/api/seatingApi';
import { colors } from '@/theme/colors';

import { OptionSheet } from './OptionSheet';

const DEFAULT_EXPIRY_HOURS = 48;
const COPIED_RESET_MS = 2000;
const CANCELABLE_STATUSES: PaymentLinkStatus[] = ['active', 'paying', 'expired'];
const SHAREABLE_STATUSES: PaymentLinkStatus[] = ['active', 'paying'];

const STATUS_COLORS: Record<PaymentLinkStatus, string> = {
  active: '#0f9f5f',
  paying: '#f97316',
  paid: '#61859d',
  expired: colors.muted,
  cancelled: colors.danger,
};

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;
  const data = error.data;
  return typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string' ? data.code : null;
}

function paymentLinkErrorMessage(code: string | null, fallback: string, t: TFunction): string {
  switch (code) {
    case 'invalid_request':
      return t('Check the table, the client name and the expiry date');
    case 'expires_in_past':
      return t('Choose an expiry date in the future');
    case 'invalid_seat':
      return t('This table is not on the event map');
    case 'table_not_on_sale':
      return t('This table is not on sale');
    case 'link_exists':
      return t('This table already has an active payment link');
    case 'table_unavailable':
      return t('This table is sold or someone is paying for it right now');
    case 'no_table_map':
      return t('This event has no table map');
    case 'forbidden':
      return t("You don't have permission to manage payment links for this event");
    case 'link_paid':
      return t('This table is already paid, so its link cannot be cancelled');
    case 'link_not_found':
      return t('Payment link not found');
    default:
      return fallback;
  }
}

function defaultExpiry() {
  const date = addHours(new Date(), DEFAULT_EXPIRY_HOURS);
  return { date: format(date, 'yyyy-MM-dd'), time: format(date, 'HH:mm') };
}

function CopyLinkButton({ url, primary = false }: { url: string; primary?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url);
    } catch {
      toast(t('Could not copy the link. Select it and copy it manually.'), 'error');
      return;
    }
    haptics.success();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <PressableScale
      onPress={() => void copy()}
      accessibilityLabel={t('Copy link')}
      className={cn(
        'items-center justify-center rounded-[10px] px-3',
        primary ? 'h-11 bg-primary dark:bg-white' : 'h-9 border border-app-border dark:border-dark-border',
      )}
    >
      <AppText className={cn('font-gilroy-semibold', primary ? 'text-[14px] text-white dark:text-primary' : 'text-[12px]')}>
        {copied ? t('Copied') : t('Copy link')}
      </AppText>
    </PressableScale>
  );
}

export function PaymentLinks({ eventId }: { eventId: number }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const locale = (i18n.language || 'ro').slice(0, 2);
  const { data: overview } = useGetPaymentLinksQuery(eventId);
  const [createLink, { isLoading: creating }] = useCreatePaymentLinkMutation();
  const [cancelLink] = useCancelPaymentLinkMutation();
  const [seatId, setSeatId] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  if (!overview) return null;

  const tableName = (table: PaymentLinkTable) => table.name_i18n?.[locale] || table.name;
  const tablesBySeat = new Map(overview.tables.map((table) => [table.seat_id, table]));
  const linkTableName = (link: TablePaymentLink) => {
    const table = tablesBySeat.get(link.seat_id);
    return table ? tableName(table) : link.table_name;
  };
  const linkableTables = overview.tables.filter((table) => table.linkable);
  const selectedTable = linkableTables.find((table) => table.seat_id === seatId) ?? null;
  const createdLink = overview.links.find((link) => link.id === createdId && link.status === 'active') ?? null;
  const missingSiteNotice = t('This event has no organizer site URL, so the link cannot be sent yet. Ask Eventino support to set it.');
  const currentYear = new Date().getFullYear();

  const tableOptionLabel = (table: PaymentLinkTable) => {
    const price = table.price !== null ? ` · ${formatPrice(Number(table.price), overview.currency)}` : '';
    const reserved = table.status === 'blocked' ? ` ${t('(reserved by you)')}` : '';
    return `${tableName(table)}${price}${reserved}`;
  };

  const statusLabel = (status: PaymentLinkStatus) => {
    if (status === 'active') return t('Active');
    if (status === 'paying') return t('Payment in progress');
    if (status === 'paid') return t('Paid');
    if (status === 'expired') return t('Expired');
    return t('Cancelled');
  };

  const formatExpiry = (iso: string) => {
    const date = new Date(iso);
    if (!isValid(date)) return '—';
    return format(date, date.getFullYear() === currentYear ? 'd MMM, HH:mm' : 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(i18n.language) });
  };

  const handleCreate = async () => {
    const name = clientName.trim();
    const expiresAt = parse(`${expiry.date} ${expiry.time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!selectedTable) {
      setFormError(t('Choose a table'));
      return;
    }
    if (!name) {
      setFormError(t("Enter the client's name"));
      return;
    }
    if (!isValid(expiresAt) || !isFuture(expiresAt)) {
      setFormError(t('Choose an expiry date in the future'));
      return;
    }
    setFormError(null);
    try {
      const result = await createLink({
        eventId,
        body: { seat_id: selectedTable.seat_id, client_name: name, note: note.trim(), expires_at: expiresAt.toISOString() },
      }).unwrap();
      haptics.success();
      setCreatedId(result.id);
      setSeatId(null);
      setClientName('');
      setNote('');
      setExpiry(defaultExpiry());
    } catch (error) {
      haptics.error();
      setFormError(paymentLinkErrorMessage(errorCode(error), t('Could not create the payment link. Please try again.'), t));
    }
  };

  const handleCancel = async (link: TablePaymentLink) => {
    setCancellingId(link.id);
    try {
      await cancelLink({ eventId, linkId: link.id }).unwrap();
      haptics.success();
      toast(t('Payment link cancelled'), 'success');
    } catch (error) {
      haptics.error();
      toast(paymentLinkErrorMessage(errorCode(error), t('Could not cancel the payment link. Please try again.'), t), 'error');
    } finally {
      setCancellingId(null);
      setConfirmingId(null);
    }
  };

  const renderLinkCell = (link: TablePaymentLink) => {
    if (!SHAREABLE_STATUSES.includes(link.status)) return null;
    if (!link.url) return <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('Site URL missing')}</AppText>;
    return <CopyLinkButton url={link.url} />;
  };

  const renderActions = (link: TablePaymentLink) => {
    if (link.cancelled_at !== null || !CANCELABLE_STATUSES.includes(link.status)) return null;
    const busy = cancellingId === link.id;
    if (confirmingId === link.id) {
      return (
        <View className="gap-2">
          <AppText className="font-gilroy-semibold text-[12px]">{t('Cancel this link?')}</AppText>
          <View className="flex-row gap-2">
            <PressableScale onPress={() => setConfirmingId(null)} disabled={busy} accessibilityLabel={t('Keep link')} className="h-9 flex-1 items-center justify-center rounded-[10px] border border-app-border dark:border-dark-border">
              <AppText className="font-gilroy-semibold text-[12px]">{t('Keep link')}</AppText>
            </PressableScale>
            <PressableScale onPress={() => void handleCancel(link)} disabled={busy} accessibilityLabel={t('Yes, cancel')} className="h-9 flex-1 items-center justify-center rounded-[10px] border border-danger/40">
              <AppText className="font-gilroy-semibold text-[12px] text-danger dark:text-danger">{busy ? t('Cancelling...') : t('Yes, cancel')}</AppText>
            </PressableScale>
          </View>
        </View>
      );
    }
    return (
      <PressableScale onPress={() => setConfirmingId(link.id)} accessibilityLabel={t('Cancel link')} className="h-9 items-center justify-center rounded-[10px] border border-app-border px-3 dark:border-dark-border">
        <AppText className="font-gilroy-semibold text-[12px]">{t('Cancel link')}</AppText>
      </PressableScale>
    );
  };

  return (
    <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View>
        <AppText className="font-gilroy-bold text-[16px]">{t('Payment links')}</AppText>
        <AppText className="mt-0.5 font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">
          {t('Send a client a link to pay for one table. While the link is active, the table shows as booked to everyone else. When it expires, the table goes back to how it was.')}
        </AppText>
        {!overview.site_url ? <AppText className="mt-1.5 font-gilroy-medium text-[12px] leading-[17px] text-danger dark:text-danger">{missingSiteNotice}</AppText> : null}
      </View>

      <View className="gap-1.5">
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Table')}</AppText>
        <PressableScale
          onPress={() => setTablePickerOpen(true)}
          disabled={linkableTables.length === 0}
          accessibilityLabel={t('Table')}
          className="h-11 flex-row items-center justify-between rounded-[10px] border border-app-border px-3 dark:border-dark-border"
        >
          <AppText numberOfLines={1} className={cn('flex-1 font-gilroy-medium text-[14px]', !selectedTable && 'text-muted dark:text-dark-muted')}>
            {selectedTable ? tableOptionLabel(selectedTable) : linkableTables.length > 0 ? t('Choose a table') : t('No free tables right now')}
          </AppText>
          <ChevronDown size={16} color={colors.muted} />
        </PressableScale>
      </View>
      <GlassInput label={t('Client name')} value={clientName} maxLength={120} autoComplete="off" onChangeText={setClientName} />
      <View className="gap-1.5">
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Link expires')}</AppText>
        <View className="flex-row gap-2">
          <EventFormDateTimeField containerClassName="flex-1" mode="date" value={expiry.date} placeholder={t('Link expires')} onChange={(date) => setExpiry((previous) => ({ ...previous, date }))} />
          <EventFormDateTimeField containerClassName="w-[110px]" mode="time" value={expiry.time} placeholder={t('Link expires')} onChange={(time) => setExpiry((previous) => ({ ...previous, time }))} />
        </View>
      </View>
      <GlassInput label={t('Note')} value={note} maxLength={255} placeholder={t('Optional, only you see it')} onChangeText={setNote} />
      {formError ? <AppText className="font-gilroy-medium text-[12px] text-danger dark:text-danger">{formError}</AppText> : null}
      <PressableScale
        onPress={() => void handleCreate()}
        disabled={creating || linkableTables.length === 0}
        accessibilityLabel={t('Create link')}
        className={cn('h-11 items-center justify-center rounded-[10px] bg-primary dark:bg-white', (creating || linkableTables.length === 0) && 'opacity-50')}
      >
        {creating ? <ActivityIndicator color={colors.muted} /> : <AppText className="font-gilroy-semibold text-[14px] text-white dark:text-primary">{t('Create link')}</AppText>}
      </PressableScale>

      {createdLink ? (
        <View className="gap-2 rounded-[12px] px-3 py-3" style={{ backgroundColor: 'rgba(15,159,95,0.1)' }}>
          <AppText className="font-gilroy-semibold text-[13px]">
            {t('The link for {{table}} is ready. Send it to {{client}}.', { table: linkTableName(createdLink), client: createdLink.client_name })}
          </AppText>
          {createdLink.url ? (
            <>
              <AppText selectable numberOfLines={2} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {createdLink.url}
              </AppText>
              <CopyLinkButton url={createdLink.url} primary />
            </>
          ) : (
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{missingSiteNotice}</AppText>
          )}
        </View>
      ) : null}

      {overview.links.length === 0 ? (
        <AppText className="py-2 text-center font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('No payment links yet.')}</AppText>
      ) : (
        <View className="gap-2">
          {overview.links.map((link) => {
            const tint = STATUS_COLORS[link.status];
            return (
              <View key={link.id} className="gap-2 rounded-[12px] border px-3 py-3" style={{ borderColor: cardBorder }}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-0.5">
                    <AppText className="font-gilroy-bold text-[15px]">{linkTableName(link)}</AppText>
                    <AppText className="font-gilroy-medium text-[13px]">{link.client_name}</AppText>
                    {link.note ? <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{link.note}</AppText> : null}
                  </View>
                  <View className="items-end gap-1">
                    <AppText className="font-gilroy-bold text-[14px]">
                      {link.price !== null ? formatPrice(Number(link.price), link.currency || overview.currency) : '—'}
                    </AppText>
                    <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${tint}1f` }}>
                      <AppText className="font-gilroy-semibold text-[11px]" style={{ color: tint }}>
                        {statusLabel(link.status)}
                      </AppText>
                    </View>
                    {link.status === 'paid' && link.order_id !== null ? (
                      <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{t('Order #{{id}}', { id: link.order_id })}</AppText>
                    ) : null}
                  </View>
                </View>
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                  {t('Expires')}: {formatExpiry(link.expires_at)}
                </AppText>
                {renderLinkCell(link) || renderActions(link) ? (
                  <View className="gap-2">
                    {renderLinkCell(link)}
                    {renderActions(link)}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {tablePickerOpen ? (
        <OptionSheet
          title={t('Choose a table')}
          options={linkableTables.map((table) => ({ value: table.seat_id, label: tableOptionLabel(table) }))}
          value={seatId}
          onPick={(next) => {
            setSeatId(next);
            setTablePickerOpen(false);
          }}
          onClose={() => setTablePickerOpen(false)}
        />
      ) : null}
    </View>
  );
}
