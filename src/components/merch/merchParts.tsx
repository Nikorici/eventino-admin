import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';

import { AppText, GlassInput, KeyboardPadding, PressableScale, SegmentedControl, Skeleton, SlideUp, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pricing';
import type { MerchFulfillmentStatus, MerchPaymentStatus } from '@/store/api/merchApi';
import { colors, currencySymbol } from '@/theme/colors';
import { sheetBottomPad } from '@/hooks/useScreenPadding';

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
      <AppText className="font-gilroy-semibold text-[11px] leading-[14px]" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText className="font-gilroy-semibold text-[13px] uppercase leading-[17px] tracking-[0.52px] text-muted dark:text-dark-muted">
      {children}
    </AppText>
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
      <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] uppercase leading-[14px] tracking-[0.44px] text-muted dark:text-dark-muted">
        {label}
      </AppText>
      <AppText numberOfLines={1} className="font-gilroy-bold text-[16px] leading-[21px]">
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
      <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{label}</AppText>
      <AppText numberOfLines={1} className="flex-1 text-right font-gilroy-medium text-[13px] leading-[17px]">
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
      <GlassInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline
        className="min-h-[88px]"
      />
      {hint ? <AppText className="font-gilroy text-[12px] leading-4 text-muted dark:text-dark-muted">{hint}</AppText> : null}
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
  spacious = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  bordered?: boolean;
  spacious?: boolean;
}) {
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const body = (
    <>
      <View className="flex-1 pr-3">
        <AppText className={cn('text-[14px] leading-[19px]', hint ? 'font-gilroy-semibold' : 'font-gilroy-medium')}>
          {label}
        </AppText>
        {hint ? <AppText className="font-gilroy-medium text-[12px] leading-4 text-muted dark:text-dark-muted">{hint}</AppText> : null}
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
  return (
    <Card
      className={cn(
        'flex-row items-center justify-between',
        hint ? 'p-4' : spacious ? 'min-h-[57px] px-4 py-3' : 'min-h-[53px] px-4 py-2.5',
      )}
    >
      {body}
    </Card>
  );
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
  compact,
  radius = 12,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  radius?: 10 | 12;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'w-full flex-row items-center justify-center gap-2 border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
        radius === 10 ? 'rounded-[10px]' : 'rounded-[12px]',
        compact ? 'h-10 px-3' : 'h-11',
        disabled && !loading && 'opacity-50',
      )}
    >
      {loading ? <ActivityIndicator size="small" color={colors.muted} /> : icon}
      <AppText numberOfLines={1} className={cn('font-gilroy-semibold', compact ? 'text-[13px]' : 'text-[14px]')}>
        {label}
      </AppText>
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
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = sheetBottomPad(insets.bottom);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardPadding>
        <View className="flex-1 justify-end" style={{ paddingTop: insets.top + 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Close')}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
            className="bg-black/40"
          />
          <SlideUp>
          <View className="max-h-full rounded-t-[24px] bg-app-bg pt-4 dark:bg-dark-bg">
            <View className="mb-4 flex-row items-center justify-between px-5">
              <AppText numberOfLines={1} className="flex-1 pr-3 font-gilroy-bold text-[20px] leading-[26px]">
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
            <KeyboardAwareScrollView
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 12 : bottomPad + 24 }}
            >
              {children}
            </KeyboardAwareScrollView>
            {footer ? (
              <View className="border-t border-app-border px-5 pt-3 dark:border-dark-border" style={{ paddingBottom: bottomPad }}>
                {footer}
              </View>
            ) : null}
          </View>
          </SlideUp>
        </View>
      </KeyboardPadding>
      <ToastHost />
    </Modal>
  );
}

export function MerchNav({ active, onChange }: { active: MerchSection; onChange: (next: MerchSection) => void }) {
  const { t } = useTranslation();
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
