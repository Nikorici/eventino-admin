import { useState } from 'react';
import { ScrollView, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale } from '@/components/ui';
import {
  MAX_QUANTITY_DISCOUNT_TIERS,
  nextQuantityDiscountRow,
  QUANTITY_DISCOUNT_ERROR_MESSAGES,
  validateQuantityDiscountTiers,
  type QuantityDiscountRow,
} from '@/components/eventForm/eventFormRules';
import { PrimaryButton, SheetModal } from '@/components/merch/merchParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { formatEventDay } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { pinnedEventDay } from '@/lib/ticketDays';
import {
  useCreateManageTicketTypeMutation,
  useUpdateManageTicketTypeMutation,
  type ManageTicketType,
  type TicketTypePayload,
} from '@/store/api/ticketTypesApi';
import { colors, currencySymbol } from '@/theme/colors';

const SCAN_COLOR_PALETTE = [
  '#1E88E5',
  '#FB8C00',
  '#8E24AA',
  '#FDD835',
  '#00ACC1',
  '#D81B60',
  '#6D4C41',
  '#3949AB',
  '#C0CA33',
  '#546E7A',
  '#E53935',
  '#43A047',
];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const STREAM_URL = /^https?:\/\/\S+$/i;

interface FormState {
  name: string;
  price: string;
  quantity: string;
  unlimited: boolean;
  eventDay: string;
  quantityDiscounts: QuantityDiscountRow[];
  isOnline: boolean;
  streamUrl: string;
  scanColor: string;
}

function formOf(ticketType: ManageTicketType | null): FormState {
  return {
    name: ticketType?.name ?? '',
    price: ticketType ? plainPrice(String(ticketType.price ?? '')) : '',
    quantity: ticketType?.quantity == null ? '' : String(ticketType.quantity),
    unlimited: ticketType ? ticketType.quantity == null : false,
    eventDay: ticketType?.event_day ?? '',
    quantityDiscounts: (ticketType?.quantity_discounts ?? []).map((tier) => ({
      min_quantity: String(tier.min_quantity),
      percent: String(tier.percent),
    })),
    isOnline: Boolean(ticketType?.is_online),
    streamUrl: ticketType?.stream_url ?? '',
    scanColor: ticketType?.scan_color ?? '',
  };
}

function plainPrice(price: string): string {
  const value = Number(price);
  return price.trim() === '' || !Number.isFinite(value) ? price : String(value);
}

function SwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (next: boolean) => void }) {
  const trackOn = useThemeColor(colors.primary, colors.accent);
  const trackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  return (
    <View className="flex-row items-center justify-between">
      <AppText className="flex-1 pr-3 font-gilroy-medium text-[15px] leading-[20px]">{label}</AppText>
      <Switch
        value={value}
        accessibilityLabel={label}
        onValueChange={(next) => {
          haptics.selection();
          onValueChange(next);
        }}
        trackColor={{ true: trackOn, false: trackOff }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function TierInput({
  value,
  width,
  accessibilityLabel,
  onChangeText,
}: {
  value: string;
  width: string;
  accessibilityLabel: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, ''))}
      keyboardType="number-pad"
      maxLength={3}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'h-12 rounded-[10px] border border-app-border bg-app-surface px-2 text-center font-gilroy text-[16px] text-primary dark:border-dark-border dark:bg-dark-surface dark:text-dark-text',
        width,
      )}
    />
  );
}

function DiscountTiers({ value, onChange }: { value: QuantityDiscountRow[]; onChange: (rows: QuantityDiscountRow[]) => void }) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<QuantityDiscountRow>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <View className="mt-0.5 gap-2">
      {value.map((row, index) => (
        <View key={index} className="flex-row items-center gap-1.5">
          <TierInput
            value={row.min_quantity}
            width="w-14"
            accessibilityLabel={t('Minimum number of tickets')}
            onChangeText={(min_quantity) => update(index, { min_quantity })}
          />
          <AppText className="font-gilroy-medium text-[13px] leading-[17px]">{t('or more tickets')}</AppText>
          <TierInput
            value={row.percent}
            width="w-[52px]"
            accessibilityLabel={t('Discount percent')}
            onChangeText={(percent) => update(index, { percent })}
          />
          <AppText className="flex-1 font-gilroy-medium text-[13px] leading-[17px]">{t('% off each')}</AppText>
          <PressableScale
            onPress={() => {
              haptics.selection();
              onChange(value.filter((_, i) => i !== index));
            }}
            accessibilityLabel={t('Remove discount tier')}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
          >
            <X size={16} color={colors.muted} />
          </PressableScale>
        </View>
      ))}
      {value.length < MAX_QUANTITY_DISCOUNT_TIERS ? (
        <PressableScale
          onPress={() => {
            haptics.selection();
            onChange([...value, nextQuantityDiscountRow(value)]);
          }}
          accessibilityLabel={t('+ Add discount tier')}
          className="h-12 items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-app-border dark:border-dark-border"
        >
          <AppText className="font-gilroy-semibold text-[15px] leading-[20px]">{t('+ Add discount tier')}</AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70 leading-[17px]">{children}</AppText>;
}

function Hint({ children }: { children: string }) {
  return <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">{children}</AppText>;
}

export function TicketTypeSheet({
  eventId,
  currency,
  pinnableDays,
  editing,
  onClose,
}: {
  eventId: number;
  currency: string;
  pinnableDays: string[];
  editing: ManageTicketType | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const submitTint = useThemeColor(colors.white, colors.primary);
  const [form, setForm] = useState<FormState>(() => formOf(editing));
  const [createTicketType, { isLoading: creating }] = useCreateManageTicketTypeMutation();
  const [updateTicketType, { isLoading: updating }] = useUpdateManageTicketTypeMutation();

  const patch = (next: Partial<FormState>) => setForm((previous) => ({ ...previous, ...next }));
  const autoColor = editing?.effective_scan_color;
  const swatchColor = HEX_COLOR.test(form.scanColor) ? form.scanColor : (autoColor ?? colors.white);

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast(t('Name is required'), 'error');
      return;
    }
    const price = form.price.trim().replace(',', '.');
    const priceValue = price === '' ? 0 : Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      toast(t('Enter a valid price'), 'error');
      return;
    }
    let quantity: number | null = null;
    if (!form.unlimited && form.quantity.trim() !== '') {
      quantity = Number(form.quantity.trim());
      if (!Number.isInteger(quantity) || quantity < 0) {
        toast(t('Enter a valid quantity'), 'error');
        return;
      }
    }
    if (editing && quantity != null && quantity < editing.sold_count) {
      toast(t('Could not save ticket type. Check the quantity is not below tickets already sold.'), 'error');
      return;
    }
    const discounts = validateQuantityDiscountTiers(form.quantityDiscounts);
    if (discounts.error) {
      toast(t(QUANTITY_DISCOUNT_ERROR_MESSAGES[discounts.error]), 'error');
      return;
    }
    const streamUrl = form.streamUrl.trim();
    if (form.isOnline && streamUrl && !STREAM_URL.test(streamUrl)) {
      toast(t('Enter the full stream link, starting with https://'), 'error');
      return;
    }
    const scanColor = form.scanColor.trim();
    if (scanColor && !HEX_COLOR.test(scanColor)) {
      toast(t('Use a hex color like #1E88E5.'), 'error');
      return;
    }
    const payload: TicketTypePayload = {
      name,
      price: price === '' ? '0' : price,
      quantity,
      ...(pinnableDays.length > 0 ? { event_day: pinnedEventDay(form.eventDay, pinnableDays) } : {}),
      quantity_discounts: discounts.tiers,
      is_online: form.isOnline,
      stream_url: form.isOnline ? streamUrl : '',
      scan_color: scanColor || null,
    };
    try {
      if (editing) {
        await updateTicketType({ ticketTypeId: editing.id, eventId, body: payload }).unwrap();
        toast(t('Ticket type updated'), 'success');
      } else {
        await createTicketType({ ...payload, event: eventId }).unwrap();
        toast(t('Ticket type created'), 'success');
      }
      haptics.success();
      onClose();
    } catch {
      haptics.error();
      toast(t('Could not save ticket type. Check the quantity is not below tickets already sold.'), 'error');
    }
  };

  return (
    <SheetModal visible onClose={onClose} title={editing ? t('Edit ticket type') : t('Add ticket type')}>
      <ScrollView
        style={{ maxHeight: height * 0.75 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4 pb-2">
          {editing ? (
            <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted leading-[17px]">
              {`${t('Sold')}: ${editing.sold_count} · ${
                editing.quantity != null ? `${t('Remaining')}: ${editing.remaining ?? 0}` : t('Unlimited')
              }`}
            </AppText>
          ) : null}
          <GlassInput
            label={t('Name')}
            placeholder={t('Ticket type name')}
            value={form.name}
            onChangeText={(name) => patch({ name })}
            autoCapitalize="sentences"
          />
          <GlassInput
            label={`${t('Price')}${currency ? ` (${currencySymbol(currency)})` : ''}`}
            placeholder="0"
            value={form.price}
            onChangeText={(price) => patch({ price })}
            keyboardType="decimal-pad"
            autoCapitalize="none"
          />
          <SwitchRow
            label={t('Unlimited')}
            value={form.unlimited}
            onValueChange={(unlimited) => patch({ unlimited })}
          />
          {form.unlimited ? null : (
            <GlassInput
              label={t('Limit')}
              placeholder="100"
              value={form.quantity}
              onChangeText={(quantity) => patch({ quantity })}
              keyboardType="number-pad"
              autoCapitalize="none"
            />
          )}
          <SwitchRow
            label={t('Live stream access')}
            value={form.isOnline}
            onValueChange={(isOnline) => patch({ isOnline })}
          />
          {form.isOnline ? (
            <View className="gap-1.5">
              <GlassInput
                label={t('Stream link')}
                placeholder="https://"
                value={form.streamUrl}
                onChangeText={(streamUrl) => patch({ streamUrl })}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Hint>
                {t(
                  'Buyers get this link after paying and by email. Live tickets are hidden from the event page, sold only through their embed link, and do not grant entry at the venue.',
                )}
              </Hint>
            </View>
          ) : null}
          {pinnableDays.length > 0 ? (
            <View className="gap-2">
              <FieldLabel>{t('Event day')}</FieldLabel>
              <View className="flex-row flex-wrap gap-2">
                {['', ...pinnableDays].map((day, dayIndex) => {
                  const active = (pinnedEventDay(form.eventDay, pinnableDays) ?? '') === day;
                  const label = day
                    ? `${t('Day {{number}}', { number: dayIndex })} · ${formatEventDay(day, i18n.language)}`
                    : t('All days');
                  return (
                    <PressableScale
                      key={day || 'all'}
                      onPress={() => {
                        haptics.selection();
                        patch({ eventDay: day });
                      }}
                      accessibilityLabel={label}
                      className={cn(
                        'h-9 justify-center rounded-full border px-3',
                        active
                          ? 'border-primary bg-primary dark:border-white dark:bg-white'
                          : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
                      )}
                    >
                      <AppText className={cn('font-gilroy-medium text-[12px] leading-[16px]', active && 'text-white dark:text-primary')}>
                        {label}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
              <Hint>
                {t(
                  'Optional. Pick the day this ticket is for and the ticket and email will show that day instead of the first day of the event.',
                )}
              </Hint>
            </View>
          ) : null}
          <View className="gap-2">
            <GlassInput
              label={t('Scan color')}
              accessibilityLabel={t('Scan color')}
              placeholder={autoColor ?? '#1E88E5'}
              value={form.scanColor}
              onChangeText={(scanColor) => patch({ scanColor: scanColor.toUpperCase() })}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              leftIcon={
                <View
                  className="h-6 w-6 rounded-[6px] border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: swatchColor }}
                />
              }
            />
            <View className="flex-row flex-wrap gap-2">
              {SCAN_COLOR_PALETTE.map((hex) => (
                <PressableScale
                  key={hex}
                  onPress={() => {
                    haptics.selection();
                    patch({ scanColor: hex });
                  }}
                  accessibilityLabel={hex}
                  className={cn(
                    'h-8 w-8 rounded-full p-0.5',
                    form.scanColor.toUpperCase() === hex && 'border-2 border-primary dark:border-white',
                  )}
                >
                  <View className="flex-1 rounded-full" style={{ backgroundColor: hex }} />
                </PressableScale>
              ))}
            </View>
            {form.scanColor ? (
              <PressableScale
                onPress={() => patch({ scanColor: '' })}
                accessibilityLabel={t('Use automatic color')}
                className="self-start py-1"
              >
                <AppText className="font-gilroy-semibold text-[13px] text-links dark:text-dark-text leading-[17px]">
                  {t('Use automatic color')}
                </AppText>
              </PressableScale>
            ) : null}
            <Hint>{t('Shown on the scanner when this ticket is scanned. Pick the wristband color to match it.')}</Hint>
          </View>
          <View className="gap-1.5">
            <FieldLabel>{t('Quantity discounts')}</FieldLabel>
            <Hint>
              {t('Optional. Each ticket gets cheaper when a buyer takes several of this ticket type in one order.')}
            </Hint>
            <DiscountTiers value={form.quantityDiscounts} onChange={(quantityDiscounts) => patch({ quantityDiscounts })} />
          </View>
          <PrimaryButton
            label={t('Save')}
            loading={creating || updating}
            onPress={() => {
              haptics.selection();
              void submit();
            }}
            icon={<Check size={18} color={submitTint} />}
          />
        </View>
      </ScrollView>
    </SheetModal>
  );
}
