import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { format } from 'date-fns';
import { CalendarClock, Check, Pencil, Plus, ShieldCheck, TicketPercent, Trash2, X } from 'lucide-react-native';

import { confirmAction } from '@/components/dashboard/dashboardParts';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { SheetModal } from '@/components/merch/merchParts';
import { AppText, Badge, Chip, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScrollInsets } from '@/hooks/useScreenPadding';
import { useSelectedEventId } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useCreateCouponMutation,
  useDeleteCouponMutation,
  useGetCouponScopeTicketTypesQuery,
  useGetEventCouponsQuery,
  useUpdateCouponMutation,
  type CouponPayload,
  type CouponScopeTicketType,
  type EventCoupon,
} from '@/store/api/couponsApi';
import { colors } from '@/theme/colors';

interface VoucherFormState {
  code: string;
  discount: string;
  maxUses: string;
  unlimited: boolean;
  isActive: boolean;
  allTickets: boolean;
  ticketTypeIds: number[];
  validFrom: Date | null;
  validUntil: Date | null;
  limitOneUsePerAccount: boolean;
  limitOneUsePerIp: boolean;
}

const emptyForm: VoucherFormState = {
  code: '',
  discount: '',
  maxUses: '',
  unlimited: true,
  isActive: true,
  allTickets: true,
  ticketTypeIds: [],
  validFrom: null,
  validUntil: null,
  limitOneUsePerAccount: false,
  limitOneUsePerIp: false,
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formFromCoupon(coupon: EventCoupon): VoucherFormState {
  return {
    code: coupon.code,
    discount: String(coupon.discount),
    maxUses: coupon.max_uses > 0 ? String(coupon.max_uses) : '',
    unlimited: coupon.max_uses === 0,
    isActive: coupon.is_active,
    allTickets: coupon.ticket_types.length === 0,
    ticketTypeIds: coupon.ticket_types,
    validFrom: parseDate(coupon.valid_from),
    validUntil: parseDate(coupon.valid_until),
    limitOneUsePerAccount: Boolean(coupon.limit_one_use_per_account),
    limitOneUsePerIp: Boolean(coupon.limit_one_use_per_ip),
  };
}

function formatDateTime(value: Date, lang: string): string {
  return format(value, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) });
}

function validityLabel(coupon: EventCoupon, lang: string, t: TFunction): string | null {
  const from = parseDate(coupon.valid_from);
  const until = parseDate(coupon.valid_until);
  if (from && until) return `${formatDateTime(from, lang)} → ${formatDateTime(until, lang)}`;
  if (from) return `${t('Valid from')} ${formatDateTime(from, lang)}`;
  if (until) return `${t('Valid until')} ${formatDateTime(until, lang)}`;
  return null;
}

function scopeNames(coupon: EventCoupon, ticketTypes: CouponScopeTicketType[]): string[] {
  if (coupon.ticket_types.length === 0) return [];
  const names = ticketTypes
    .filter((ticketType) => coupon.ticket_types.includes(ticketType.id))
    .map((ticketType) => ticketType.name);
  return names.length > 0 ? names : coupon.ticket_types.map((ticketTypeId) => `#${ticketTypeId}`);
}

const keyExtractor = (item: EventCoupon) => String(item.id);

const ItemSeparator = () => <View className="h-2.5" />;

function ScopePill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-black/[0.05] px-2.5 py-1 dark:bg-white/10">
      <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] text-primary dark:text-dark-text">
        {label}
      </AppText>
    </View>
  );
}

function IconAction({
  icon: Icon,
  label,
  destructive,
  busy,
  onPress,
}: {
  icon: typeof Pencil;
  label: string;
  destructive?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const tint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={busy}
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : (
        <Icon size={16} color={destructive ? colors.danger : tint} />
      )}
    </PressableScale>
  );
}

function VoucherCard({
  coupon,
  ticketTypes,
  toggling,
  deleting,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  coupon: EventCoupon;
  ticketTypes: CouponScopeTicketType[];
  toggling: boolean;
  deleting: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const validity = validityLabel(coupon, i18n.language, t);
  const names = scopeNames(coupon, ticketTypes);
  const usesLabel =
    coupon.max_uses > 0
      ? `${t('Used')} ${coupon.usage_count}/${coupon.max_uses}`
      : `${t('Used')} ${coupon.usage_count} · ${t('Unlimited')}`;
  const limitLabels: string[] = [];
  if (coupon.limit_one_use_per_account) limitLabels.push(t('1 / account'));
  if (coupon.limit_one_use_per_ip) limitLabels.push(t('1 / IP'));

  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <AppText numberOfLines={1} className="shrink font-gilroy-bold text-[16px]">
            {coupon.code}
          </AppText>
          <Badge label={`-${coupon.discount}%`} className="bg-primary dark:bg-white" textClassName="text-white dark:text-primary" />
        </View>
        <Switch
          value={coupon.is_active}
          disabled={toggling}
          onValueChange={onToggleActive}
          accessibilityLabel={coupon.is_active ? t('Deactivate') : t('Activate')}
          trackColor={{ true: switchTrackOn, false: switchTrackOff }}
          thumbColor={colors.white}
        />
      </View>

      <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
        {usesLabel} · {coupon.is_active ? t('Active') : t('Inactive')}
      </AppText>

      {validity ? (
        <View className="flex-row items-center gap-1.5">
          <CalendarClock size={13} color={colors.muted} />
          <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {validity}
          </AppText>
        </View>
      ) : null}

      {limitLabels.length > 0 ? (
        <View className="flex-row items-center gap-1.5">
          <ShieldCheck size={13} color={colors.muted} />
          <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {limitLabels.join(' · ')}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          {names.length === 0 ? (
            <ScopePill label={t('All tickets')} />
          ) : (
            names.map((name) => <ScopePill key={name} label={name} />)
          )}
        </View>
        <View className="flex-row gap-2">
          <IconAction icon={Pencil} label={t('Edit voucher')} onPress={onEdit} />
          <IconAction icon={Trash2} label={t('Delete')} destructive busy={deleting} onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

function VoucherCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-11" style={{ borderRadius: 14 }} />
      </View>
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-3 w-36" />
      <View className="flex-row items-end justify-between">
        <Skeleton className="h-6 w-24" style={{ borderRadius: 12 }} />
        <View className="flex-row gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </View>
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <AppText className="flex-1 font-gilroy-medium text-[15px]">{label}</AppText>
        <Switch
          value={value}
          accessibilityLabel={label}
          onValueChange={(next) => {
            haptics.selection();
            onChange(next);
          }}
          trackColor={{ true: switchTrackOn, false: switchTrackOff }}
          thumbColor={colors.white}
        />
      </View>
      {description ? (
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{description}</AppText>
      ) : null}
    </View>
  );
}

function VoucherDateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const [iosOpen, setIosOpen] = useState(false);
  const [androidStage, setAndroidStage] = useState<'date' | 'time' | null>(null);
  const [temp, setTemp] = useState<Date>(new Date());

  const display = value ? formatDateTime(value, i18n.language) : '';

  const openPicker = () => {
    haptics.selection();
    setTemp(value ?? new Date());
    if (Platform.OS === 'android') {
      setAndroidStage('date');
    } else {
      setIosOpen(true);
    }
  };

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type !== 'set' || !date) {
      setAndroidStage(null);
      return;
    }
    if (androidStage === 'date') {
      setTemp(date);
      setAndroidStage('time');
      return;
    }
    const combined = new Date(temp);
    combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setAndroidStage(null);
    onChange(combined);
  };

  const handleIosChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) setTemp(date);
  };

  const confirmIos = () => {
    onChange(temp);
    setIosOpen(false);
  };

  return (
    <View className="gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{label}</AppText>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <PressableScale
            onPress={openPicker}
            accessibilityLabel={label}
            className="h-12 w-full flex-row items-center gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface"
          >
            <CalendarClock size={16} color={colors.muted} />
            <AppText
              numberOfLines={1}
              className={cn(
                'flex-1 font-gilroy-medium text-[15px]',
                display ? 'text-primary dark:text-dark-text' : 'text-muted dark:text-dark-muted',
              )}
            >
              {display || t('Select date and time')}
            </AppText>
          </PressableScale>
        </View>
        {value ? (
          <PressableScale
            onPress={() => {
              haptics.selection();
              onChange(null);
            }}
            accessibilityLabel={t('Clear')}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
          >
            <X size={16} color={colors.muted} />
          </PressableScale>
        ) : null}
      </View>

      {Platform.OS === 'android' && androidStage ? (
        <DateTimePicker value={temp} mode={androidStage} is24Hour onChange={handleAndroidChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View className="flex-1 justify-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
              onPress={() => setIosOpen(false)}
              style={StyleSheet.absoluteFill}
              className="bg-black/40"
            />
            <View className="rounded-t-[20px] bg-app-bg pb-8 pt-3 dark:bg-dark-surface">
              <View className="mb-1 flex-row items-center justify-between px-5">
                <PressableScale onPress={() => setIosOpen(false)} accessibilityLabel={t('Cancel')}>
                  <AppText className="font-gilroy-medium text-[15px] text-muted dark:text-dark-muted">{t('Cancel')}</AppText>
                </PressableScale>
                <PressableScale onPress={confirmIos} accessibilityLabel={t('Done')}>
                  <AppText className="font-gilroy-semibold text-[15px] text-links dark:text-dark-text">{t('Done')}</AppText>
                </PressableScale>
              </View>
              <DateTimePicker
                value={temp}
                mode="datetime"
                display="spinner"
                is24Hour
                themeVariant={isDark ? 'dark' : 'light'}
                textColor={isDark ? colors.dark.text : colors.primary}
                onChange={handleIosChange}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export default function VouchersScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const scroll = useScrollInsets();
  const eventId = useSelectedEventId();
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const submitTint = useThemeColor(colors.white, colors.primary);

  const couponsQuery = useGetEventCouponsQuery(eventId ?? 0, { skip: eventId == null });
  const { data: ticketTypesData, refetch: refetchTicketTypes } = useGetCouponScopeTicketTypesQuery(eventId ?? 0, {
    skip: eventId == null,
  });

  const [createCoupon, { isLoading: creating }] = useCreateCouponMutation();
  const [updateCoupon, { isLoading: updating }] = useUpdateCouponMutation();
  const [deleteCoupon] = useDeleteCouponMutation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EventCoupon | null>(null);
  const [form, setForm] = useState<VoucherFormState>(emptyForm);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const coupons = couponsQuery.data ?? [];
  const ticketTypes = ticketTypesData ?? [];
  const saving = creating || updating;

  const openCreate = useCallback(() => {
    haptics.light();
    setEditing(null);
    setForm(emptyForm);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((coupon: EventCoupon) => {
    setEditing(coupon);
    setForm(formFromCoupon(coupon));
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }, []);

  const toggleAllTickets = useCallback((next: boolean) => {
    setForm((prev) => ({ ...prev, allTickets: next, ticketTypeIds: next ? [] : prev.ticketTypeIds }));
  }, []);

  const toggleTicketType = useCallback((ticketTypeId: number) => {
    setForm((prev) => {
      const base = prev.allTickets ? [] : prev.ticketTypeIds;
      const next = base.includes(ticketTypeId)
        ? base.filter((existing) => existing !== ticketTypeId)
        : [...base, ticketTypeId];
      return { ...prev, allTickets: next.length === 0, ticketTypeIds: next };
    });
  }, []);

  const submit = async () => {
    if (eventId == null) return;
    const code = form.code.trim();
    if (!code) {
      toast(t('Code is required'), 'error');
      return;
    }
    const discount = Number.parseInt(form.discount, 10);
    if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
      toast(t('Discount must be between 1 and 100'), 'error');
      return;
    }
    if (form.validFrom && form.validUntil && form.validUntil.getTime() <= form.validFrom.getTime()) {
      toast(t('Valid until must be after valid from'), 'error');
      return;
    }
    const ticketTypeIds = form.allTickets ? [] : form.ticketTypeIds;
    if (!form.allTickets && ticketTypeIds.length === 0) {
      toast(t('Select at least one ticket type, or choose "Apply to all tickets".'), 'error');
      return;
    }
    const parsedMaxUses = Number.parseInt(form.maxUses, 10);
    const payload: CouponPayload = {
      code,
      discount,
      max_uses: form.unlimited || !Number.isInteger(parsedMaxUses) || parsedMaxUses < 0 ? 0 : parsedMaxUses,
      is_active: form.isActive,
      ticket_types: ticketTypeIds,
      valid_from: form.validFrom ? form.validFrom.toISOString() : null,
      valid_until: form.validUntil ? form.validUntil.toISOString() : null,
      limit_one_use_per_account: form.limitOneUsePerAccount,
      limit_one_use_per_ip: form.limitOneUsePerIp,
    };
    try {
      if (editing) {
        await updateCoupon({ couponId: editing.id, eventId, body: payload }).unwrap();
        toast(t('Voucher updated'), 'success');
      } else {
        await createCoupon({ ...payload, event: eventId }).unwrap();
        toast(t('Voucher created'), 'success');
      }
      closeSheet();
    } catch {
      toast(t('Could not save voucher. Check the code is unique and the limit is not below current usage.'), 'error');
    }
  };

  const onToggleActive = async (coupon: EventCoupon) => {
    if (eventId == null) return;
    haptics.selection();
    setTogglingId(coupon.id);
    try {
      await updateCoupon({ couponId: coupon.id, eventId, body: { is_active: !coupon.is_active } }).unwrap();
      toast(coupon.is_active ? t('Voucher deactivated') : t('Voucher activated'), 'success');
    } catch {
      toast(t('Could not update voucher'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const performDelete = async (coupon: EventCoupon) => {
    if (eventId == null) return;
    setDeletingId(coupon.id);
    try {
      await deleteCoupon({ couponId: coupon.id, eventId }).unwrap();
      toast(t('Voucher deleted'), 'success');
    } catch {
      toast(t('This voucher has been used. Deactivate it instead of deleting.'), 'info');
    } finally {
      setDeletingId(null);
    }
  };

  const onDelete = (coupon: EventCoupon) => {
    haptics.medium();
    confirmAction({
      title: t('Delete this voucher?'),
      message: coupon.code,
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: () => void performDelete(coupon),
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([couponsQuery.refetch(), refetchTicketTypes()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Vouchers')}
        onBack={navigate.back}
        right={
          <PressableScale
            onPress={openCreate}
            accessibilityLabel={t('Add voucher')}
            className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
          >
            <Plus size={18} color={headerIconTint} />
          </PressableScale>
        }
      />
      <FlashList
        data={coupons}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <VoucherCard
            coupon={item}
            ticketTypes={ticketTypes}
            toggling={togglingId === item.id}
            deleting={deletingId === item.id}
            onToggleActive={() => void onToggleActive(item)}
            onEdit={() => openEdit(item)}
            onDelete={() => onDelete(item)}
          />
        )}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View className="gap-1.5 pb-4">
            <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">
              {t('Create discount codes and set how many times each can be used.')}
            </AppText>
            {coupons.length > 0 ? (
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {t('Total')}: {coupons.length}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          couponsQuery.isLoading || eventId == null ? (
            <View className="gap-2.5">
              <VoucherCardSkeleton />
              <VoucherCardSkeleton />
              <VoucherCardSkeleton />
            </View>
          ) : couponsQuery.isError ? (
            <EmptyState
              icon={TicketPercent}
              title={t('Something went wrong.')}
              message={t('Please try again.')}
              actionLabel={t('Try again')}
              onAction={() => void couponsQuery.refetch()}
            />
          ) : (
            <EmptyState
              icon={TicketPercent}
              title={t('No vouchers yet.')}
              actionLabel={t('Add voucher')}
              onAction={openCreate}
            />
          )
        }
        {...scroll.scrollProps}
        contentContainerStyle={{ paddingTop: scroll.paddingTop, paddingBottom: scroll.paddingBottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={scroll.refreshOffset}
          />
        }
      />

      {sheetOpen ? (
        <SheetModal
          visible
          title={editing ? t('Edit voucher') : t('Add voucher')}
          onClose={closeSheet}
          footer={
            <PressableScale
              onPress={() => {
                haptics.selection();
                void submit();
              }}
              disabled={saving}
              accessibilityLabel={t('Save')}
              className="h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white"
            >
              {saving ? (
                <ActivityIndicator color={submitTint} />
              ) : (
                <>
                  <Check size={18} color={submitTint} />
                  <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">{t('Save')}</AppText>
                </>
              )}
            </PressableScale>
          }
        >
          <View className="gap-4">
            <GlassInput
              label={t('Code')}
              placeholder={t('Voucher code')}
              value={form.code}
              onChangeText={(text) => setForm((prev) => ({ ...prev, code: text }))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            <GlassInput
              label={`${t('Discount')} (%)`}
              placeholder="10"
              value={form.discount}
              onChangeText={(text) => setForm((prev) => ({ ...prev, discount: text }))}
              keyboardType="number-pad"
            />
            <SwitchRow
              label={t('Unlimited uses')}
              value={form.unlimited}
              onChange={(next) => setForm((prev) => ({ ...prev, unlimited: next }))}
            />
            {!form.unlimited ? (
              <GlassInput
                label={t('Usage limit')}
                placeholder="100"
                value={form.maxUses}
                onChangeText={(text) => setForm((prev) => ({ ...prev, maxUses: text }))}
                keyboardType="number-pad"
              />
            ) : null}
            <View className="gap-2">
              <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                {t('Applies to tickets')}
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                <Chip label={t('All tickets')} selected={form.allTickets} onPress={() => toggleAllTickets(true)} />
                {ticketTypes.map((ticketType) => (
                  <Chip
                    key={ticketType.id}
                    label={ticketType.name}
                    selected={!form.allTickets && form.ticketTypeIds.includes(ticketType.id)}
                    onPress={() => toggleTicketType(ticketType.id)}
                  />
                ))}
              </View>
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {ticketTypes.length === 0
                  ? t('No ticket types')
                  : form.allTickets
                    ? t('The discount applies to every ticket type.')
                    : t('Select the ticket types the discount applies to.')}
              </AppText>
            </View>
            <VoucherDateTimeField
              label={t('Valid from')}
              value={form.validFrom}
              onChange={(next) => setForm((prev) => ({ ...prev, validFrom: next }))}
            />
            <VoucherDateTimeField
              label={t('Valid until')}
              value={form.validUntil}
              onChange={(next) => setForm((prev) => ({ ...prev, validUntil: next }))}
            />
            <View className="gap-3">
              <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                {t('Abuse prevention')}
              </AppText>
              <SwitchRow
                label={t('Limit to one use per account')}
                description={t(
                  'Prevents the same Eventino account from successfully using this voucher more than once.',
                )}
                value={form.limitOneUsePerAccount}
                onChange={(next) => setForm((prev) => ({ ...prev, limitOneUsePerAccount: next }))}
              />
              <SwitchRow
                label={t('Limit to one use per IP address')}
                description={t(
                  'Prevents the voucher from being successfully used more than once from the same public IP address. Users sharing a network (office, university, hotel, mobile carrier) may be affected.',
                )}
                value={form.limitOneUsePerIp}
                onChange={(next) => setForm((prev) => ({ ...prev, limitOneUsePerIp: next }))}
              />
            </View>
            <SwitchRow
              label={t('Active')}
              value={form.isActive}
              onChange={(next) => setForm((prev) => ({ ...prev, isActive: next }))}
            />
          </View>
        </SheetModal>
      ) : null}
    </Screen>
  );
}
