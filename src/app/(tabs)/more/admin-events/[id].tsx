import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Landmark, Pencil, ShieldAlert, Trash2 } from 'lucide-react-native';

import { confirmAction } from '@/components/dashboard/dashboardParts';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { EventFormDateTimeField } from '@/components/events/EventFormDateTimeField';
import { SheetModal, ToggleRow } from '@/components/merch/merchParts';
import { AppText, Chip, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import {
  commissionLabel,
  formatAccountingAmount,
  moneyFromAccounting,
  remainingDisplay,
  settlementFromAccounting,
} from '@/lib/accounting';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { formatEventDay } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  ACCOUNTING_PAYMENT_STATUSES,
  TRANSFER_STATUSES,
  useCreateEventTransferMutation,
  useDeleteEventTransferMutation,
  useGetEventAccountingQuery,
  useUpdateEventAccountingMutation,
  useUpdateEventTransferMutation,
  type AccountingPaymentStatus,
  type EventAccounting,
  type EventTransfer,
  type TransferBody,
  type TransferStatus,
} from '@/store/api/accountingApi';
import { colors } from '@/theme/colors';

const STATUS_TONES: Record<string, { background: string; color: string }> = {
  PENDING: { background: 'rgba(217,119,6,0.14)', color: '#b45309' },
  PARTIAL: { background: 'rgba(37,99,235,0.14)', color: '#2563eb' },
  PAID: { background: 'rgba(15,159,95,0.14)', color: '#0f9f5f' },
  OVERDUE: { background: 'rgba(216,54,54,0.12)', color: colors.danger },
  CANCELLED: { background: 'rgba(138,141,147,0.16)', color: colors.muted },
  FAILED: { background: 'rgba(216,54,54,0.12)', color: colors.danger },
};

type Tone = 'default' | 'positive' | 'accent' | 'info' | 'warning' | 'danger';

const TONE_COLORS: Record<Tone, string | null> = {
  default: null,
  positive: '#0f9f5f',
  accent: '#61859d',
  info: '#2563eb',
  warning: '#b45309',
  danger: colors.danger,
};

interface TransferForm {
  payment_number: string;
  amount: string;
  currency: string;
  transfer_date: string;
  recipient_name: string;
  recipient_iban: string;
  reference: string;
  status: TransferStatus;
  notes: string;
}

interface SettingsForm {
  has_vat: boolean;
  vat_percent: string;
  has_tax: boolean;
  tax_percent: string;
  payment_status: AccountingPaymentStatus;
  case_closed: boolean;
  notes: string;
  recipient_name: string;
  recipient_iban: string;
}

function emptyTransferForm(): TransferForm {
  return {
    payment_number: '',
    amount: '',
    currency: '',
    transfer_date: '',
    recipient_name: '',
    recipient_iban: '',
    reference: '',
    status: 'PENDING',
    notes: '',
  };
}

function transferFormFrom(transfer: EventTransfer): TransferForm {
  return {
    payment_number: transfer.payment_number != null ? String(transfer.payment_number) : '',
    amount: transfer.amount ?? '',
    currency: transfer.currency ?? '',
    transfer_date: transfer.transfer_date ?? '',
    recipient_name: transfer.recipient_name ?? '',
    recipient_iban: transfer.recipient_iban ?? '',
    reference: transfer.reference ?? '',
    status: transfer.status ?? 'PENDING',
    notes: transfer.notes ?? '',
  };
}

function transferBody(form: TransferForm, fallbackCurrency: string): TransferBody {
  return {
    ...(form.payment_number ? { payment_number: Number(form.payment_number) } : {}),
    amount: Number(form.amount) || 0,
    currency: form.currency || fallbackCurrency,
    transfer_date: form.transfer_date || null,
    recipient_name: form.recipient_name,
    recipient_iban: form.recipient_iban,
    reference: form.reference,
    status: form.status,
    notes: form.notes,
  };
}

function settingsFrom(data: EventAccounting): SettingsForm {
  return {
    has_vat: Boolean(data.has_vat),
    vat_percent: String(data.vat_percent ?? 0),
    has_tax: Boolean(data.has_tax),
    tax_percent: String(data.tax_percent ?? 0),
    payment_status: data.payment_status || 'PENDING',
    case_closed: Boolean(data.case_closed),
    notes: data.notes ?? '',
    recipient_name: data.recipient_name ?? '',
    recipient_iban: data.recipient_iban ?? '',
  };
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status] ?? STATUS_TONES.CANCELLED;
  return (
    <View className="shrink-0 rounded-full px-2.5 py-1" style={{ backgroundColor: tone.background }}>
      <AppText className="font-gilroy-bold text-[10px] uppercase tracking-[0.04em]" style={{ color: tone.color }}>
        {t(status)}
      </AppText>
    </View>
  );
}

function Card({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      {title ? <AppText className="font-gilroy-bold text-[16px]">{title}</AppText> : null}
      {note ? (
        <AppText className="font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">{note}</AppText>
      ) : null}
      {children}
    </View>
  );
}

function Figure({
  label,
  value,
  secondary,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  secondary?: string;
  hint?: string;
  tone?: Tone;
}) {
  const color = TONE_COLORS[tone];
  return (
    <View className="min-w-[45%] flex-1 gap-0.5 rounded-[12px] bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]">
      <AppText className="font-gilroy-medium text-[11px] uppercase tracking-[0.04em] text-muted dark:text-dark-muted">
        {label}
      </AppText>
      <AppText className="font-gilroy-bold text-[16px]" style={color ? { color } : undefined}>
        {value}
      </AppText>
      {secondary ? (
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{secondary}</AppText>
      ) : null}
      {hint ? <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{hint}</AppText> : null}
    </View>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{label}</AppText>
      <AppText className="flex-1 text-right font-gilroy-semibold text-[13px] leading-[17px]">{value}</AppText>
    </View>
  );
}

function NotesField({
  value,
  placeholder,
  onChangeText,
}: {
  value: string;
  placeholder?: string;
  onChangeText: (next: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="w-full gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Notes')}</AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={t('Notes')}
        multiline
        textAlignVertical="top"
        className="h-20 rounded-[10px] border border-app-border bg-app-surface px-3 py-3 font-gilroy text-[16px] leading-[22px] text-primary dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
      />
    </View>
  );
}

function SettingToggle(props: Parameters<typeof ToggleRow>[0]) {
  return (
    <View className="py-1">
      <ToggleRow bordered={false} {...props} />
    </View>
  );
}

const CHIP_LABEL_KEYS: Partial<Record<string, string>> = { OVERDUE: 'Overdue' };

function SubmitButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const tint = useThemeColor(colors.white, colors.primary);
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={loading || disabled}
      accessibilityLabel={label}
      className={cn('h-12 items-center justify-center rounded-[12px] bg-primary dark:bg-white', disabled && 'opacity-50')}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <AppText className="font-gilroy-semibold text-[15px] text-white dark:text-primary">{label}</AppText>
      )}
    </PressableScale>
  );
}

function StatusChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{label}</AppText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} label={t(CHIP_LABEL_KEYS[option] ?? option)} selected={value === option} onPress={() => onChange(option)} />
        ))}
      </View>
    </View>
  );
}

function TransferFields({
  form,
  onChange,
  fallbackCurrency,
  placeholders,
}: {
  form: TransferForm;
  onChange: (next: TransferForm) => void;
  fallbackCurrency: string;
  placeholders: { name: string; iban: string };
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <GlassInput
            label={t('Payment #')}
            placeholder={t('Auto')}
            value={form.payment_number}
            keyboardType="number-pad"
            onChangeText={(payment_number) => onChange({ ...form, payment_number: payment_number.replace(/\D/g, '') })}
          />
        </View>
        <View className="flex-1 gap-1.5">
          <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Date')}</AppText>
          <EventFormDateTimeField
            value={form.transfer_date}
            mode="date"
            placeholder={t('Date')}
            icon={<CalendarDays size={14} color={colors.muted} />}
            onChange={(transfer_date) => onChange({ ...form, transfer_date })}
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <GlassInput
            label={t('Amount')}
            placeholder="0.00"
            value={form.amount}
            keyboardType="decimal-pad"
            onChangeText={(amount) => onChange({ ...form, amount: amount.replace(',', '.') })}
          />
        </View>
        <View className="w-28">
          <GlassInput
            label={t('Currency')}
            value={form.currency || fallbackCurrency}
            autoCapitalize="characters"
            onChangeText={(currency) => onChange({ ...form, currency: currency.toUpperCase() })}
          />
        </View>
      </View>
      <GlassInput
        label={t('Recipient name')}
        placeholder={placeholders.name}
        value={form.recipient_name}
        onChangeText={(recipient_name) => onChange({ ...form, recipient_name })}
      />
      <GlassInput
        label="IBAN"
        placeholder={placeholders.iban}
        value={form.recipient_iban}
        autoCapitalize="characters"
        onChangeText={(recipient_iban) => onChange({ ...form, recipient_iban })}
      />
      <GlassInput
        label={t('Reference')}
        value={form.reference}
        onChangeText={(reference) => onChange({ ...form, reference })}
      />
      <StatusChips
        label={t('Status')}
        options={TRANSFER_STATUSES}
        value={form.status}
        onChange={(status) => onChange({ ...form, status })}
      />
      <NotesField value={form.notes} onChangeText={(notes) => onChange({ ...form, notes })} />
    </View>
  );
}

function EditTransferSheet({
  transfer,
  currency,
  placeholders,
  saving,
  onClose,
  onSave,
}: {
  transfer: EventTransfer;
  currency: string;
  placeholders: { name: string; iban: string };
  saving: boolean;
  onClose: () => void;
  onSave: (form: TransferForm) => void;
}) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const [form, setForm] = useState<TransferForm>(() => transferFormFrom(transfer));
  return (
    <SheetModal visible title={t('Edit transfer')} onClose={onClose}>
      <ScrollView
        style={{ maxHeight: windowHeight * 0.6 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TransferFields form={form} onChange={setForm} fallbackCurrency={currency} placeholders={placeholders} />
      </ScrollView>
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1">
          <PressableScale
            onPress={onClose}
            accessibilityLabel={t('Cancel')}
            className="h-12 w-full items-center justify-center rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface"
          >
            <AppText className="font-gilroy-semibold text-[15px]">{t('Cancel')}</AppText>
          </PressableScale>
        </View>
        <View className="flex-1">
          <SubmitButton label={t('Save')} loading={saving} onPress={() => onSave(form)} />
        </View>
      </View>
    </SheetModal>
  );
}

function AccountingSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-16 w-full rounded-[14px]" />
      <Skeleton className="h-40 w-full rounded-[14px]" />
      <Skeleton className="h-40 w-full rounded-[14px]" />
      <Skeleton className="h-28 w-full rounded-[14px]" />
    </View>
  );
}

export default function AdminAccountingScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const padding = useScreenPadding();
  const { isAuthenticated, user } = useAuth();
  const eventId = Number(id);
  const isStaff = user?.is_staff === true;
  const skip = !isAuthenticated || !isStaff || !eventId;

  const { data, isLoading, isError, refetch } = useGetEventAccountingQuery(eventId, { skip });
  const [updateAccounting, { isLoading: savingSettings }] = useUpdateEventAccountingMutation();
  const [createTransfer, { isLoading: addingTransfer }] = useCreateEventTransferMutation();
  const [updateTransfer, { isLoading: savingTransfer }] = useUpdateEventTransferMutation();
  const [deleteTransfer] = useDeleteEventTransferMutation();

  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);
  const [editing, setEditing] = useState<EventTransfer | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [syncedData, setSyncedData] = useState<EventAccounting | undefined>(undefined);
  if (data !== syncedData) {
    setSyncedData(data);
    if (data) setSettings(settingsFrom(data));
  }

  const currency = data?.currency || data?.event_currency || '';
  const settlement = useMemo(() => settlementFromAccounting(data), [data]);
  const money = useMemo(() => moneyFromAccounting(data), [data]);
  const commission = useMemo(
    () => commissionLabel(data, { buyer: t('Buyer'), organizer: t('Organizer'), prefix: t('Commission paid by') }),
    [data, t],
  );
  const fallbackCurrency = settlement?.currency || currency;
  const company = data?.company ?? null;
  const placeholders = {
    name: settings?.recipient_name || company?.name || '',
    iban: settings?.recipient_iban || company?.iban || '',
  };

  const feeHint = useMemo(() => {
    if (!money) return '';
    const parts: string[] = [];
    if (money.feePercent > 0) parts.push(`${money.feePercent}% ${t('charged on top of the ticket price')}`);
    if (money.feeVat > 0) parts.push(`${t('VAT')} ${t('included')}: ${formatAccountingAmount(money.feeVat, currency)}`);
    if (parts.length > 0) return parts.join(' · ');
    return money.fee > 0 ? t('Charged on top of the ticket price') : t('No client fee charged for this organizer');
  }, [money, currency, t]);

  const failed = (error: unknown) => {
    haptics.error();
    const message = extractApiError(error);
    toast(message ? t(message) : t('Update failed'), 'error');
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      await updateAccounting({
        eventId,
        patch: {
          has_vat: settings.has_vat,
          vat_percent: Number(settings.vat_percent) || 0,
          has_tax: settings.has_tax,
          tax_percent: Number(settings.tax_percent) || 0,
          payment_status: settings.payment_status,
          case_closed: settings.case_closed,
          notes: settings.notes,
          recipient_name: settings.recipient_name,
          recipient_iban: settings.recipient_iban,
        },
      }).unwrap();
      haptics.success();
      toast(t('Accounting saved'), 'success');
    } catch (error) {
      failed(error);
    }
  };

  const addTransfer = async () => {
    try {
      await createTransfer({ eventId, body: transferBody(transferForm, fallbackCurrency) }).unwrap();
      haptics.success();
      setTransferForm(emptyTransferForm());
      toast(t('Transfer added'), 'success');
    } catch (error) {
      failed(error);
    }
  };

  const saveEdit = async (form: TransferForm) => {
    if (!editing) return;
    try {
      await updateTransfer({ eventId, transferId: editing.id, body: transferBody(form, fallbackCurrency) }).unwrap();
      haptics.success();
      setEditing(null);
      toast(t('Transfer updated'), 'success');
    } catch (error) {
      failed(error);
    }
  };

  const confirmDelete = (transfer: EventTransfer) => {
    haptics.medium();
    confirmAction({
      title: t('Delete this transfer?'),
      message: `#${transfer.payment_number ?? '—'} · ${formatAccountingAmount(transfer.amount, transfer.currency || currency)}`,
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: () => {
        deleteTransfer({ eventId, transferId: transfer.id })
          .unwrap()
          .then(() => toast(t('Transfer deleted'), 'success'))
          .catch(failed);
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (!isAuthenticated || !isStaff) {
      return (
        <View style={{ paddingTop: padding.top }} className="flex-1 items-center justify-center">
          <EmptyState
            icon={ShieldAlert}
            title={!isAuthenticated ? t('You must be logged in for this action.') : t('Not available')}
            message={isAuthenticated ? t('This section is only available to platform staff.') : undefined}
            actionLabel={!isAuthenticated ? t('Log In') : undefined}
            onAction={!isAuthenticated ? navigate.login : undefined}
          />
        </View>
      );
    }
    if (isError && !data) {
      return (
        <View style={{ paddingTop: padding.top }} className="flex-1 justify-center">
          <EmptyState
            icon={Landmark}
            title={t('Something went wrong.')}
            message={t('Please try again.')}
            actionLabel={t('Try again')}
            onAction={() => void refetch()}
          />
        </View>
      );
    }
    if (isLoading || !data || !settings) {
      return (
        <View style={{ paddingTop: padding.top }} className="px-4">
          <AccountingSkeleton />
        </View>
      );
    }

    const remaining = remainingDisplay(Number(data.remaining_amount) || 0, currency, t('Overpaid by'));
    const settlementRemaining = settlement
      ? remainingDisplay(settlement.remaining, settlement.currency, t('Overpaid by'))
      : null;
    const transfers = data.transfers ?? [];
    const refundedOrders = Number(data.refunded_orders_count) || 0;

    return (
      <KeyboardAwareScrollView
        bottomOffset={24}
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
        <View className="gap-4">
          <View className="flex-row items-start gap-3 px-1">
            <View className="flex-1">
              <AppText className="font-gilroy-bold text-[22px] leading-[27px]">{data.event_title}</AppText>
              <AppText className="mt-1 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                #{data.event} · {data.event_country} · {formatEventDay(data.event_start_date, i18n.language) || '—'} –{' '}
                {formatEventDay(data.event_end_date, i18n.language) || '—'}
              </AppText>
            </View>
            <StatusPill status={settings.payment_status} />
          </View>

          {settlement && settlementRemaining ? (
            <Card
              title={`${t('Settled in')} ${settlement.currency}`}
              note={`${t('What the payment provider actually charged buyers and what you wire to the organizer')}${
                settlement.rate > 0
                  ? ` · ${t('blended rate')} ${settlement.rate.toFixed(4)} ${settlement.currency}/${currency}`
                  : ''
              }`}
            >
              <View className="flex-row flex-wrap gap-2">
                <Figure
                  tone="positive"
                  label={t('Collected')}
                  value={formatAccountingAmount(settlement.gross, settlement.currency)}
                  secondary={formatAccountingAmount(settlement.base, currency)}
                  hint={`${t('Online orders')}: ${settlement.ordersCount}`}
                />
                {settlement.commission > 0 ? (
                  <Figure
                    label={commission ?? t('Commission')}
                    value={formatAccountingAmount(settlement.commission, settlement.currency)}
                  />
                ) : null}
                <Figure
                  tone="accent"
                  label={t('Total to transfer')}
                  value={formatAccountingAmount(settlement.net, settlement.currency)}
                  hint={t('Ticket money minus commission')}
                />
                <Figure
                  tone="positive"
                  label={t('Transferred so far')}
                  value={formatAccountingAmount(settlement.paid, settlement.currency)}
                  hint={`${t('Transfers recorded in')} ${settlement.currency}`}
                />
                <Figure tone={settlementRemaining.tone} label={t('Left to transfer')} value={settlementRemaining.text} />
              </View>
              {settlement.unsettledTotal > 0 ? (
                <View className="gap-1">
                  <Pair
                    label={`${t('Not settled in')} ${settlement.currency}`}
                    value={formatAccountingAmount(settlement.unsettledTotal, settlement.unsettledCurrency)}
                  />
                  <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                    {t('Paid by invoice or without provider data — settle separately')} · {t('Orders')}:{' '}
                    {settlement.unsettledOrdersCount}
                  </AppText>
                </View>
              ) : null}
            </Card>
          ) : null}

          <Card
            title={`${t('Money collected')}${settlement ? ` — ${currency}` : ''}`}
            note={
              settlement
                ? `${t('Event currency, all orders included. Reference only — money moves in')} ${settlement.currency}`
                : undefined
            }
          >
            <View className="flex-row flex-wrap gap-2">
              <Figure
                label={t('Ticket money')}
                value={formatAccountingAmount(money?.tickets, currency)}
                hint={t('Tickets only, without the client fee')}
              />
              <Figure tone="info" label={t('Client fee')} value={formatAccountingAmount(money?.fee, currency)} hint={feeHint} />
              <Figure
                tone="positive"
                label={t('Total collected')}
                value={formatAccountingAmount(money?.collected, currency)}
                hint={t('Ticket money + client fee')}
              />
              {refundedOrders > 0 ? (
                <Figure
                  tone="info"
                  label={t('Client fee on refunded orders')}
                  value={formatAccountingAmount(data.refunded_buyer_fee_total, currency)}
                  hint={`${refundedOrders} ${t('refunded orders, not included in Total collected')}`}
                />
              ) : null}
            </View>
            <View className="gap-1.5">
              <Pair label={t('Organizer receives')} value={formatAccountingAmount(money?.organizer, currency)} />
              <Pair label={t('Eventino keeps')} value={formatAccountingAmount(money?.eventino, currency)} />
              {money && money.commission > 0 ? (
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                  {t('Client fee')}: {formatAccountingAmount(money.fee, currency)} · {t('Commission from organizer')}:{' '}
                  {formatAccountingAmount(money.commission, currency)}
                </AppText>
              ) : null}
            </View>
          </Card>

          <Card>
            <View className="flex-row flex-wrap gap-2">
              <Figure
                label={t('Gross total')}
                value={formatAccountingAmount(data.gross_total, currency)}
                hint={t('Tickets only, without the client fee')}
              />
              <Figure label={t('VAT')} value={formatAccountingAmount(data.vat_amount, currency)} />
              <Figure label={t('Tax')} value={formatAccountingAmount(data.tax_amount, currency)} />
              {Number(data.commission_amount) > 0 ? (
                <Figure label={commission ?? t('Commission')} value={formatAccountingAmount(data.commission_amount, currency)} />
              ) : null}
              <Figure
                tone="accent"
                label={t('Net to organizer')}
                value={formatAccountingAmount(data.net_to_organizer, currency)}
                hint={t('Ticket money minus commission')}
              />
              <Figure tone="positive" label={t('Paid so far')} value={formatAccountingAmount(data.paid_total, currency)} />
              <Figure tone={remaining.tone} label={t('Remaining')} value={remaining.text} />
            </View>
          </Card>

          <Card title={t('Ticket totals')}>
            <View className="flex-row flex-wrap gap-2">
              <Figure label={t('Total ticket revenue')} value={formatAccountingAmount(data.tickets_income, currency)} />
              <Figure label={t('Tickets sold')} value={String(Number(data.tickets_sold) || 0)} />
              <Figure
                tone="positive"
                label={t('Total received')}
                value={formatAccountingAmount(data.total_received, currency)}
                hint={t('Cashed online, invoice orders excluded')}
              />
            </View>
            {commission ? (
              <AppText className="font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{commission}</AppText>
            ) : null}
          </Card>

          <Card
            title={`${t('Transfer summary')}${settlement ? ` — ${currency}` : ''}`}
            note={settlement ? `${t('Only transfers recorded in')} ${currency}` : undefined}
          >
            <View className="flex-row flex-wrap gap-2">
              <Figure
                tone="accent"
                label={t('Total to transfer')}
                value={formatAccountingAmount(data.net_to_organizer, currency)}
              />
              <Figure
                tone="positive"
                label={t('Transferred so far')}
                value={formatAccountingAmount(data.paid_total, currency)}
              />
              <Figure tone={remaining.tone} label={t('Left to transfer')} value={remaining.text} />
            </View>
          </Card>

          <Card title={t('Company details')}>
            {company ? (
              <View className="gap-2">
                <Pair label={t('Company name')} value={company.name || '—'} />
                <Pair label={t('Registration number (SRL)')} value={company.registration_number || '—'} />
                <Pair label="IDNP / IDNO / CUI" value={company.cui || '—'} />
                <Pair
                  label={t('Address')}
                  value={
                    [company.address, company.city, company.county, company.postal_code, company.country_code]
                      .filter(Boolean)
                      .join(', ') || '—'
                  }
                />
                <Pair label="IBAN" value={company.iban || '—'} />
                <Pair label={t('Email')} value={company.email || '—'} />
                <Pair label={t('Phone')} value={company.phone || '—'} />
              </View>
            ) : (
              <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
                {t('No company linked to this event yet.')}
              </AppText>
            )}
          </Card>

          <Card title={t('Recipient & settings')}>
            <GlassInput
              label={t('Recipient name')}
              placeholder={company?.name ?? ''}
              value={settings.recipient_name}
              onChangeText={(recipient_name) => setSettings({ ...settings, recipient_name })}
            />
            <GlassInput
              label={t('Recipient IBAN')}
              placeholder={company?.iban ?? ''}
              value={settings.recipient_iban}
              autoCapitalize="characters"
              onChangeText={(recipient_iban) => setSettings({ ...settings, recipient_iban })}
            />
            <SettingToggle
              label={t('Applies VAT')}
              value={settings.has_vat}
              onValueChange={(has_vat) => setSettings({ ...settings, has_vat })}
            />
            {settings.has_vat ? (
              <GlassInput
                label={t('VAT %')}
                value={settings.vat_percent}
                keyboardType="decimal-pad"
                onChangeText={(vat_percent) => setSettings({ ...settings, vat_percent: vat_percent.replace(',', '.') })}
              />
            ) : null}
            <SettingToggle
              label={t('Applies tax')}
              value={settings.has_tax}
              onValueChange={(has_tax) => setSettings({ ...settings, has_tax })}
            />
            {settings.has_tax ? (
              <GlassInput
                label={t('Tax %')}
                value={settings.tax_percent}
                keyboardType="decimal-pad"
                onChangeText={(tax_percent) => setSettings({ ...settings, tax_percent: tax_percent.replace(',', '.') })}
              />
            ) : null}
            <StatusChips
              label={t('Payment status')}
              options={ACCOUNTING_PAYMENT_STATUSES}
              value={settings.payment_status}
              onChange={(payment_status) => setSettings({ ...settings, payment_status })}
            />
            <SettingToggle
              label={t('Case closed')}
              value={settings.case_closed}
              onValueChange={(case_closed) => setSettings({ ...settings, case_closed })}
            />
            <NotesField
              placeholder={t('Internal notes…')}
              value={settings.notes}
              onChangeText={(notes) => setSettings({ ...settings, notes })}
            />
            <SubmitButton
              label={savingSettings ? t('Saving…') : t('Save changes')}
              loading={savingSettings}
              onPress={() => void saveSettings()}
            />
          </Card>

          <Card title={t('Transfers')}>
            {transfers.length === 0 ? (
              <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
                {t('No transfers recorded yet.')}
              </AppText>
            ) : (
              <View className="gap-2">
                {transfers.map((transfer) => (
                  <View key={transfer.id} className="gap-2 rounded-[12px] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.05]">
                    <View className="flex-row items-center justify-between gap-3">
                      <AppText className="flex-1 font-gilroy-bold text-[15px]">
                        #{transfer.payment_number ?? '—'} · {formatAccountingAmount(transfer.amount, transfer.currency || currency)}
                      </AppText>
                      <StatusPill status={transfer.status} />
                    </View>
                    <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                      {transfer.transfer_date ? formatEventDay(transfer.transfer_date, i18n.language) : '—'} ·{' '}
                      {transfer.recipient_name || '—'} · {transfer.recipient_iban || '—'} · {transfer.reference || '—'}
                    </AppText>
                    <View className="flex-row gap-2">
                      <PressableScale
                        onPress={() => {
                          haptics.selection();
                          setEditing(transfer);
                        }}
                        accessibilityLabel={t('Edit')}
                        className="h-9 flex-row items-center gap-1.5 rounded-full border border-app-border px-3 dark:border-dark-border"
                      >
                        <Pencil size={13} color={colors.muted} />
                        <AppText className="font-gilroy-semibold text-[13px]">{t('Edit')}</AppText>
                      </PressableScale>
                      <PressableScale
                        onPress={() => confirmDelete(transfer)}
                        accessibilityLabel={t('Delete')}
                        className="h-9 flex-row items-center gap-1.5 rounded-full border border-danger/40 px-3"
                      >
                        <Trash2 size={13} color={colors.danger} />
                        <AppText className="font-gilroy-semibold text-[13px] text-danger dark:text-danger">{t('Delete')}</AppText>
                      </PressableScale>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <AppText className="mt-2 font-gilroy-bold text-[15px]">{t('Add a transfer')}</AppText>
            <TransferFields
              form={transferForm}
              onChange={setTransferForm}
              fallbackCurrency={fallbackCurrency}
              placeholders={placeholders}
            />
            <SubmitButton
              label={t('Add transfer')}
              loading={addingTransfer}
              disabled={!transferForm.amount}
              onPress={() => void addTransfer()}
            />
          </Card>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  return (
    <Screen edges={[]}>
      {renderBody()}
      <GlassHeader title={t('Accounting')} onBack={navigate.back} />
      {editing ? (
        <EditTransferSheet
          transfer={editing}
          currency={fallbackCurrency}
          placeholders={placeholders}
          saving={savingTransfer}
          onClose={() => setEditing(null)}
          onSave={(form) => void saveEdit(form)}
        />
      ) : null}
    </Screen>
  );
}
