import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, Switch, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';

import { AppText, PressableScale, SegmentedControl, Skeleton, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { formatMoney } from '@/lib/pricing';
import type { MerchFulfillmentStatus, MerchPaymentStatus } from '@/store/api/merchApi';
import { colors, currencySymbol } from '@/theme/colors';

export const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
export const INTEGER_PATTERN = /^\d+$/;

export type MerchSection = 'products' | 'orders' | 'settings';

export function money(amount: string | number, currency: string): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const symbol = currencySymbol(currency);
  return symbol ? `${symbol} ${formatMoney(safe)}` : formatMoney(safe);
}

export function formatDateTime(value: string | null | undefined, lang: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) });
}

export function paymentColor(status: MerchPaymentStatus): string {
  switch (status) {
    case 'PAID':
      return '#34c759';
    case 'PENDING':
      return '#f97316';
    case 'FAILED':
      return colors.danger;
    case 'REFUNDED':
      return colors.muted;
  }
}

export function fulfillmentColor(status: MerchFulfillmentStatus): string {
  switch (status) {
    case 'DELIVERED':
      return '#34c759';
    case 'CANCELLED':
      return colors.danger;
    case 'NEW':
    case 'PROCESSING':
    case 'SHIPPED':
      return colors.accent;
  }
}

export function useCardBorder(): string {
  return useThemeColor(CARD_BORDER, colors.dark.border);
}

export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View className="self-start rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${color}22` }}>
      <AppText className="font-gilroy-semibold text-[11px]" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText className="font-gilroy-semibold text-[13px] uppercase tracking-wide text-muted">{children}</AppText>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  const cardBorder = useCardBorder();
  return (
    <View
      className={cn('rounded-[12px] border bg-white dark:bg-dark-surface', className)}
      style={{ borderColor: cardBorder }}
    >
      {children}
    </View>
  );
}

export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex-1 gap-1 p-3">
      <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] uppercase tracking-wide text-muted">
        {label}
      </AppText>
      <AppText numberOfLines={1} className="font-gilroy-bold text-[16px]">
        {value}
      </AppText>
    </Card>
  );
}

export function CardSkeleton() {
  return (
    <Card className="gap-2 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </View>
        <View className="items-end gap-1.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3 w-20" />
        </View>
      </View>
      <View className="flex-row gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </View>
    </Card>
  );
}

export function ListSkeleton() {
  return (
    <View className="gap-2.5">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1">
      <AppText className="font-gilroy-medium text-[13px] text-muted">{label}</AppText>
      <AppText numberOfLines={1} className="flex-1 text-right font-gilroy-medium text-[13px]">
        {value}
      </AppText>
    </View>
  );
}

export function MultilineInput({
  label,
  placeholder,
  value,
  onChangeText,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
}) {
  return (
    <View className="w-full gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{label}</AppText>
      <View className="rounded-[10px] border border-app-border bg-app-surface px-3 py-2.5 dark:border-dark-border dark:bg-dark-surface">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          className="min-h-[88px] font-gilroy text-base text-primary dark:text-dark-text"
          style={{ textAlignVertical: 'top' }}
        />
      </View>
      {hint ? <AppText className="font-gilroy-medium text-[12px] text-muted">{hint}</AppText> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
  bordered = true,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  bordered?: boolean;
}) {
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const body = (
    <>
      <View className="flex-1 pr-3">
        <AppText className={cn('text-[14px]', hint ? 'font-gilroy-semibold' : 'font-gilroy-medium')}>{label}</AppText>
        {hint ? <AppText className="font-gilroy-medium text-[12px] text-muted">{hint}</AppText> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        accessibilityLabel={label}
        onValueChange={(next) => {
          haptics.selection();
          onValueChange(next);
        }}
        trackColor={{ true: switchTrackOn, false: switchTrackOff }}
        thumbColor={colors.white}
      />
    </>
  );
  if (!bordered) return <View className="flex-row items-center justify-between">{body}</View>;
  return <Card className={cn('flex-row items-center justify-between', hint ? 'p-4' : 'px-4 py-2.5')}>{body}</Card>;
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  compact,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  compact?: boolean;
}) {
  const tint = useThemeColor(colors.white, colors.primary);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white',
        compact ? 'h-11' : 'h-[52px]',
        disabled && !loading && 'opacity-50',
      )}
    >
      {loading ? <ActivityIndicator color={tint} /> : icon}
      {loading ? null : (
        <AppText
          className={cn(
            'text-white dark:text-primary',
            compact ? 'font-gilroy-semibold text-[14px]' : 'font-gilroy-bold text-[16px]',
          )}
        >
          {label}
        </AppText>
      )}
    </PressableScale>
  );
}

export function SecondaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'h-11 w-full flex-row items-center justify-center gap-2 rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
        disabled && !loading && 'opacity-50',
      )}
    >
      {loading ? <ActivityIndicator size="small" color={colors.muted} /> : icon}
      <AppText className="font-gilroy-semibold text-[14px]">{label}</AppText>
    </PressableScale>
  );
}

export function DangerButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className="h-11 w-full flex-row items-center justify-center gap-2 rounded-[12px]"
      style={{ backgroundColor: `${colors.danger}18` }}
    >
      {loading ? <ActivityIndicator size="small" color={colors.danger} /> : icon}
      <AppText className="font-gilroy-semibold text-[14px]" style={{ color: colors.danger }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function SheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText numberOfLines={1} className="flex-1 pr-3 font-gilroy-bold text-[20px]">
                {title}
              </AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}

export function MerchNav({ active }: { active: MerchSection }) {
  const { t } = useTranslation();
  const onChange = (next: MerchSection) => {
    if (next === active) return;
    if (next === 'products') {
      navigate.dismissTo('merch');
      return;
    }
    const key = next === 'orders' ? 'merchOrders' : 'merchSettings';
    if (active === 'products') navigate.to(key);
    else navigate.replace(key);
  };
  return (
    <SegmentedControl<MerchSection>
      value={active}
      onChange={onChange}
      options={[
        { value: 'products', label: t('Products') },
        { value: 'orders', label: t('Orders') },
        { value: 'settings', label: t('Settings') },
      ]}
    />
  );
}
