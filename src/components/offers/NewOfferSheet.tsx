import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Plus, Trash2 } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale, Stepper } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { EventFormDateTimeField } from '@/components/events/EventFormDateTimeField';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pricing';
import {
  emptyInstallmentRows,
  installmentsComplete,
  installmentsMatchTotal,
  installmentsSum,
  splitEqually,
  type InstallmentRowInput,
} from '@/lib/privateOffers';
import { useCreateOfferMutation, useLazyGetOfferQuoteQuery } from '@/store/api/privateOffersApi';
import type { ManageTicketType } from '@/store/api/ticketTypesApi';
import { colors } from '@/theme/colors';

import { OfferFormSheet } from './offerParts';

interface OfferForm {
  name: string;
  recipientEmail: string;
  message: string;
  ticketTypeId: number | null;
  quantity: number;
  customTotal: string;
  useInstallments: boolean;
}

const emptyForm: OfferForm = {
  name: '',
  recipientEmail: '',
  message: '',
  ticketTypeId: null,
  quantity: 1,
  customTotal: '',
  useInstallments: true,
};

export function NewOfferSheet({
  eventId,
  ticketTypes,
  onClose,
  onCreated,
}: {
  eventId: number;
  ticketTypes: ManageTicketType[];
  onClose: () => void;
  onCreated: (withInstallments: boolean) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [rows, setRows] = useState<InstallmentRowInput[]>(() => emptyInstallmentRows());
  const [createOffer, { isLoading: saving }] = useCreateOfferMutation();
  const [fetchQuote] = useLazyGetOfferQuoteQuery();

  const quotedTotal = useCallback(
    async (ticketTypeId: number | null, quantity: number): Promise<string> => {
      const type = ticketTypes.find((item) => item.id === ticketTypeId);
      if (!type) return '';
      const base = (Number(type.price) * Math.max(1, quantity)).toFixed(2);
      try {
        const quote = await fetchQuote({ eventId, amount: base }).unwrap();
        return quote.client_total ? String(quote.client_total) : base;
      } catch {
        return base;
      }
    },
    [ticketTypes, fetchQuote, eventId],
  );

  const prefillTotal = async (next: OfferForm) => {
    setForm(next);
    const total = await quotedTotal(next.ticketTypeId, next.quantity);
    if (total) setForm((previous) => ({ ...previous, customTotal: total }));
  };

  const resolveTotal = async (): Promise<string> => {
    if (Number(form.customTotal)) return form.customTotal;
    const total = await quotedTotal(form.ticketTypeId, form.quantity);
    if (total) setForm((previous) => ({ ...previous, customTotal: total }));
    return total;
  };

  const rowsSum = installmentsSum(rows);
  const totalNumber = Number(form.customTotal) || 0;
  const sumMatches = installmentsMatchTotal(rows, totalNumber);

  const setRow = (index: number, patch: Partial<InstallmentRowInput>) =>
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const applyEqualSplit = async () => {
    const total = await resolveTotal();
    const amounts = splitEqually(total, rows.length);
    if (amounts.length === 0) {
      toast(t('Select a ticket type'), 'error');
      return;
    }
    haptics.selection();
    setRows((previous) => previous.map((row, index) => ({ ...row, amount: amounts[index] })));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast(t('Name is required'), 'error');
    if (!form.recipientEmail.trim()) return toast(t('Client email is required'), 'error');
    if (form.ticketTypeId == null) return toast(t('Select a ticket type'), 'error');
    const total = await resolveTotal();
    const totalNum = Number(total) || 0;
    if (!totalNum) return toast(t('Select a ticket type'), 'error');
    if (form.useInstallments) {
      if (!installmentsComplete(rows)) return toast(t('Every installment needs a date and an amount'), 'error');
      if (!installmentsMatchTotal(rows, totalNum)) return toast(t('Installment amounts must add up to the total price'), 'error');
    }
    try {
      await createOffer({
        event: eventId,
        name: form.name.trim(),
        recipient_email: form.recipientEmail.trim(),
        message: form.message,
        pricing_mode: 'FIXED_TOTAL',
        custom_total_price: totalNum.toFixed(2),
        max_redemptions: 1,
        items: [{ ticket_type: form.ticketTypeId, quantity: Math.max(1, form.quantity) }],
        ...(form.useInstallments
          ? { installments: rows.map((row) => ({ due_date: row.due_date, amount: Number(row.amount).toFixed(2) })) }
          : {}),
      }).unwrap();
      haptics.success();
      onCreated(form.useInstallments);
    } catch (error) {
      haptics.error();
      const message = extractApiError(error);
      toast(message ? t(message) : t('Something went wrong.'), 'error');
    }
  };

  return (
    <OfferFormSheet
      title={t('New private offer')}
      submitLabel={t('Create offer')}
      saving={saving}
      onSubmit={() => void handleSave()}
      onClose={onClose}
    >
      <GlassInput label={t('Offer name')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <GlassInput
        label={t('Client email')}
        value={form.recipientEmail}
        onChangeText={(recipientEmail) => setForm({ ...form, recipientEmail })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <GlassInput label={t('Message (optional)')} value={form.message} onChangeText={(message) => setForm({ ...form, message })} />

      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Ticket type')}</AppText>
      <View className="flex-row flex-wrap gap-2">
        {ticketTypes.map((type) => {
          const active = form.ticketTypeId === type.id;
          return (
            <PressableScale
              key={type.id}
              onPress={() => {
                haptics.selection();
                void prefillTotal({ ...form, ticketTypeId: type.id });
              }}
              accessibilityLabel={type.name}
              className={cn(
                'h-10 flex-row items-center rounded-full border px-4',
                active
                  ? 'border-primary bg-primary dark:border-white dark:bg-white'
                  : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
              )}
            >
              <AppText className={cn('font-gilroy-medium text-[13px]', active ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text')}>
                {type.name} ({formatMoney(Number(type.price) || 0)})
              </AppText>
            </PressableScale>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between">
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Quantity')}</AppText>
        <Stepper value={form.quantity} min={1} max={50} onChange={(quantity) => void prefillTotal({ ...form, quantity })} />
      </View>

      <GlassInput
        label={t('Total price')}
        value={form.customTotal}
        onChangeText={(customTotal) => setForm({ ...form, customTotal: customTotal.replace(/[^0-9.,]/g, '').replace(',', '.') })}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
        {t('This is the final price the client pays — VAT and platform fees included.')}
      </AppText>

      <View className="flex-row items-center justify-between rounded-[12px] border px-4 py-3" style={{ borderColor: cardBorder }}>
        <AppText className="font-gilroy-semibold text-[14px]">{t('Payable in installments')}</AppText>
        <Switch
          value={form.useInstallments}
          onValueChange={(useInstallments) => {
            haptics.selection();
            setForm({ ...form, useInstallments });
          }}
          trackColor={{ true: switchTrackOn, false: switchTrackOff }}
          thumbColor={colors.white}
          accessibilityLabel={t('Payable in installments')}
        />
      </View>

      {form.useInstallments ? (
        <View className="gap-2">
          {rows.map((row, index) => (
            <View key={index} className="flex-row items-center gap-2">
              <AppText className="w-6 font-gilroy-semibold text-[13px] text-muted dark:text-dark-muted">#{index + 1}</AppText>
              <View className="flex-1">
                <EventFormDateTimeField
                  value={row.due_date}
                  mode="date"
                  placeholder={t('Date')}
                  icon={<CalendarDays size={14} color={colors.muted} />}
                  onChange={(due_date) => setRow(index, { due_date })}
                />
              </View>
              <View className="w-24">
                <GlassInput
                  placeholder={t('Amount')}
                  accessibilityLabel={t('Amount')}
                  value={row.amount}
                  keyboardType="decimal-pad"
                  onChangeText={(amount) => setRow(index, { amount: amount.replace(',', '.') })}
                />
              </View>
              <PressableScale
                onPress={() => setRows((previous) => (previous.length > 2 ? previous.filter((_, i) => i !== index) : previous))}
                disabled={rows.length <= 2}
                accessibilityLabel={t('Remove')}
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10',
                  rows.length <= 2 && 'opacity-40',
                )}
              >
                <Trash2 size={15} color={colors.muted} />
              </PressableScale>
            </View>
          ))}
          <View className="flex-row items-center gap-2">
            <PressableScale
              onPress={() => {
                haptics.selection();
                setRows((previous) => [...previous, { due_date: '', amount: '' }]);
              }}
              accessibilityLabel={t('Add payment')}
              className="h-9 flex-row items-center gap-1 rounded-full border border-app-border px-3 dark:border-dark-border"
            >
              <Plus size={14} color={colors.muted} />
              <AppText className="font-gilroy-semibold text-[13px]">{t('Add payment')}</AppText>
            </PressableScale>
            <PressableScale
              onPress={() => void applyEqualSplit()}
              accessibilityLabel={t('Split equally')}
              className="h-9 justify-center rounded-full border border-app-border px-3 dark:border-dark-border"
            >
              <AppText className="font-gilroy-semibold text-[13px]">{t('Split equally')}</AppText>
            </PressableScale>
            <AppText className={cn('ml-auto font-gilroy-semibold text-[13px]', sumMatches ? 'text-success dark:text-success' : 'text-danger dark:text-danger')}>
              {rowsSum.toFixed(2)} / {totalNumber.toFixed(2)}
            </AppText>
          </View>
        </View>
      ) : null}
    </OfferFormSheet>
  );
}
