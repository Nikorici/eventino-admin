import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

import { AppText, PressableScale, Skeleton, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { WEB_ORIGIN } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

export type OfferTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const TONES: Record<OfferTone, { background: string; color: string }> = {
  success: { background: 'rgba(15,159,95,0.14)', color: '#0f9f5f' },
  info: { background: 'rgba(37,99,235,0.14)', color: '#2563eb' },
  warning: { background: 'rgba(245,158,11,0.16)', color: '#b45309' },
  danger: { background: 'rgba(216,54,54,0.12)', color: colors.danger },
  neutral: { background: 'rgba(138,141,147,0.16)', color: colors.muted },
};

export async function copyOfferLink(token: string) {
  haptics.light();
  await Clipboard.setStringAsync(`${WEB_ORIGIN}/offer/${token}`);
}

export function OfferActionButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  icon: typeof X;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const textColor = useThemeColor(colors.primary, colors.dark.text);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className={
        danger
          ? 'h-9 flex-row items-center gap-1.5 rounded-full border border-danger/40 px-3'
          : 'h-9 flex-row items-center gap-1.5 rounded-full border border-app-border px-3 dark:border-dark-border'
      }
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Icon size={14} color={danger ? colors.danger : textColor} />
      <AppText className={danger ? 'font-gilroy-semibold text-[13px] text-danger dark:text-danger' : 'font-gilroy-semibold text-[13px]'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function OfferCard({
  title,
  subtitle,
  statusLabel,
  tone,
  amount,
  aside,
  actions,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: OfferTone;
  amount: string;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const { background, color } = TONES[tone];
  return (
    <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-bold text-[16px]">
            {title}
          </AppText>
          <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {subtitle}
          </AppText>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: background }}>
          <AppText className="font-gilroy-bold text-[10px] uppercase tracking-wide" style={{ color }}>
            {statusLabel}
          </AppText>
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <AppText className="font-gilroy-bold text-[18px]">{amount}</AppText>
        {aside ? <View className="flex-shrink items-end">{aside}</View> : null}
      </View>
      {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
    </View>
  );
}

export function OffersSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-32 w-full rounded-[14px]" />
      <Skeleton className="h-32 w-full rounded-[14px]" />
      <Skeleton className="h-32 w-full rounded-[14px]" />
    </View>
  );
}

export function OfferFormSheet({
  title,
  submitLabel,
  saving,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  submitLabel: string;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View
            className="rounded-t-[24px] bg-app-bg px-5 pt-4 dark:bg-dark-bg"
            style={{ paddingBottom: insets.bottom + 12, maxHeight: windowHeight * 0.88 }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="flex-1 pr-3 font-gilroy-bold text-[20px]">{title}</AppText>
              <PressableScale
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </PressableScale>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-3">{children}</View>
            </ScrollView>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <PressableScale
                  onPress={onClose}
                  accessibilityLabel={t('Cancel')}
                  className="h-[52px] w-full items-center justify-center rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface"
                >
                  <AppText className="font-gilroy-semibold text-[16px]">{t('Cancel')}</AppText>
                </PressableScale>
              </View>
              <View className="flex-1">
                <PressableScale
                  onPress={onSubmit}
                  disabled={saving}
                  accessibilityLabel={submitLabel}
                  className="h-[52px] w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white"
                >
                  {saving ? (
                    <ActivityIndicator color={colors.muted} />
                  ) : (
                    <AppText className="font-gilroy-semibold text-[16px] text-white dark:text-primary">{submitLabel}</AppText>
                  )}
                </PressableScale>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost />
    </Modal>
  );
}
