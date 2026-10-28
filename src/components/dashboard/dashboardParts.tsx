import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { AlertTriangle, Search, X, type LucideIcon } from 'lucide-react-native';

import { AppText, GlassButton, GlassInput, PressableScale, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { shareFile, type ShareFileOptions } from '@/lib/downloads';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pricing';
import { getAccessToken } from '@/lib/storage';
import { colors, currencySymbol } from '@/theme/colors';

export const ACCENT_GREEN = '#34c759';
export const ACCENT_RED = '#ff3b30';
export const ACCENT_ORANGE = '#ff9500';
export const ROW_DIVIDER = '#f0f2f8';
export const PDF_SHARE: ShareFileOptions = {
  mimeType: 'application/pdf',
  UTI: 'com.adobe.pdf',
};
export const XLSX_SHARE: ShareFileOptions = {
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  UTI: 'org.openxmlformats.spreadsheetml.sheet',
};
export const XML_SHARE: ShareFileOptions = {
  mimeType: 'application/xml',
  UTI: 'public.xml',
};

export function formatDateTimeLabel(value: string | null | undefined, lang: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) });
}

export function moneyLabel(amount: number | string | null | undefined, currency: string | null | undefined): string {
  const value = Number(amount ?? 0);
  return `${currencySymbol(currency ?? '')} ${formatMoney(Number.isFinite(value) ? value : 0)}`.trim();
}

export function personName(
  person:
    | {
        first_name?: string | null;
        last_name?: string | null;
        name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback: string,
): string {
  const full = `${person?.first_name?.trim() ?? ''} ${person?.last_name?.trim() ?? ''}`.trim();
  if (full) return full;
  if (person?.name?.trim()) return person.name.trim();
  if (person?.email) return person.email.split('@')[0];
  return fallback;
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length
    ? parts
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : 'NA';
}

export function ticketSummary(tickets: { ticket_type_name?: string | null }[] | undefined): string {
  const counts = new Map<string, number>();
  for (const ticket of tickets ?? []) {
    if (ticket.ticket_type_name) counts.set(ticket.ticket_type_name, (counts.get(ticket.ticket_type_name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => (count > 1 ? `${count} × ${name}` : name)).join(', ');
}

export function matchesQuery(query: string, values: (string | number | null | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(needle),
  );
}

export function confirmAction(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    if (window.confirm(options.message ? `${options.title}\n\n${options.message}` : options.title)) options.onConfirm();
    return;
  }
  Alert.alert(options.title, options.message, [
    { text: options.cancelLabel, style: 'cancel' },
    {
      text: options.confirmLabel,
      style: options.destructive ? 'destructive' : 'default',
      onPress: options.onConfirm,
    },
  ]);
}

export function useFileAction() {
  const { t } = useTranslation();
  const toast = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    async (
      key: string,
      load: (token: string) => Promise<string>,
      share: ShareFileOptions,
      messages?: { success?: string; error?: string },
    ): Promise<boolean> => {
      if (busyKey) return false;
      void haptics.selection();
      setBusyKey(key);
      try {
        const token = await getAccessToken();
        if (!token) {
          toast(t('You must be logged in for this action.'), 'error');
          return false;
        }
        const uri = await load(token);
        const shared = await shareFile(uri, share);
        if (!shared) await WebBrowser.openBrowserAsync(uri);
        if (messages?.success) toast(messages.success, 'success');
        return true;
      } catch {
        toast(messages?.error ?? t('Please try again.'), 'error');
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, toast, t],
  );

  return { busyKey, run };
}

export function SectionTitle({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <View className="gap-0.5">
      <AppText className="font-gilroy-bold text-[18px]">{children}</AppText>
      {subtitle ? <AppText className="font-gilroy-medium text-[13px] text-muted">{subtitle}</AppText> : null}
    </View>
  );
}

export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className={cn('rounded-[12px] border bg-white px-4 dark:bg-dark-surface', className)}
      style={{ borderColor: cardBorder }}
    >
      {children}
    </View>
  );
}

export function RowDivider({ index, children }: { index: number; children: ReactNode }) {
  const rowDivider = useThemeColor(ROW_DIVIDER, colors.dark.border);
  return (
    <View className={index > 0 ? 'border-t' : ''} style={index > 0 ? { borderColor: rowDivider } : undefined}>
      {children}
    </View>
  );
}

export function Avatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand/20 dark:bg-dark-elevated">
      {image ? (
        <Image source={{ uri: image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{initials(name)}</AppText>
      )}
    </View>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}1f` }}>
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[11px]" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  return (
    <GlassInput
      placeholder={placeholder}
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={placeholder}
      leftIcon={<Search size={18} color={colors.muted} />}
      rightIcon={
        value ? (
          <PressableScale onPress={() => onChange('')} accessibilityLabel={t('Clear search')} hitSlop={8}>
            <X size={16} color={colors.muted} />
          </PressableScale>
        ) : undefined
      }
    />
  );
}

export function SmallAction({
  icon: Icon,
  label,
  onPress,
  loading,
  color,
  className,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  loading?: boolean;
  color?: string;
  className?: string;
  accessibilityLabel?: string;
}) {
  const themed = useThemeColor(colors.primary, colors.dark.text);
  const tint = color ?? themed;
  return (
    <PressableScale
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={accessibilityLabel ?? label}
      className={cn(
        'h-9 flex-row items-center justify-center gap-1.5 rounded-full px-3.5',
        color ? '' : 'bg-black/[0.05] dark:bg-white/10',
        className,
      )}
      style={color ? { backgroundColor: `${color}1f` } : undefined}
    >
      {loading ? <ActivityIndicator size="small" color={tint} /> : <Icon size={14} color={tint} />}
      <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[12px]" style={{ color: tint }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function HeaderAction({
  icon: Icon,
  label,
  onPress,
  loading,
  variant = 'solid',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'solid' | 'outline' | 'danger';
}) {
  const outline = variant === 'outline' || variant === 'danger';
  const themedIcon = useThemeColor(outline ? colors.primary : colors.white, outline ? colors.dark.text : colors.primary);
  const iconColor = variant === 'danger' ? colors.danger : themedIcon;
  return (
    <View className="flex-1">
      <PressableScale
        onPress={onPress}
        disabled={loading}
        accessibilityLabel={label}
        className={cn(
          'h-11 w-full flex-row items-center justify-center gap-2 rounded-[10px] px-2',
          variant === 'danger'
            ? 'border border-danger/40 bg-white dark:bg-dark-surface'
            : outline
              ? 'border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface'
              : 'bg-primary dark:bg-white',
        )}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <>
            <Icon size={16} color={iconColor} />
            <AppText
              numberOfLines={1}
              className={cn(
                'shrink font-gilroy-semibold text-[13px]',
                variant === 'danger'
                  ? 'text-danger'
                  : outline
                    ? 'text-primary dark:text-dark-text'
                    : 'text-white dark:text-primary',
              )}
            >
              {label}
            </AppText>
          </>
        )}
      </PressableScale>
    </View>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <PanelCard>
      {Array.from({ length: rows }, (_, index) => (
        <RowDivider key={index} index={index}>
          <View className="flex-row items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <View className="flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </View>
            <Skeleton className="h-4 w-14" />
          </View>
        </RowDivider>
      ))}
    </PanelCard>
  );
}

export function PanelMessage({ text }: { text: string }) {
  return <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">{text}</AppText>;
}

export function PanelError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <PanelCard className="items-center gap-2 py-6">
      <AlertTriangle size={22} color={colors.muted} />
      <AppText className="text-center font-gilroy-semibold text-[15px]">{t('Something went wrong.')}</AppText>
      <AppText className="text-center font-gilroy-medium text-[13px] text-muted">{t('Please try again.')}</AppText>
      <GlassButton label={t('Try again')} variant="secondary" size="sm" onPress={onRetry} className="mt-1" />
    </PanelCard>
  );
}

export function FooterCount({ label, count }: { label: string; count: number }) {
  return (
    <AppText className="px-1 font-gilroy-medium text-[13px] text-muted">
      {label}: <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{count}</AppText>
    </AppText>
  );
}
