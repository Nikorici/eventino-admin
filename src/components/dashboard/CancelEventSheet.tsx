import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { extractApiError } from '@/lib/apiError';
import { formatMoney } from '@/lib/pricing';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { useCancelEventMutation, useGetEventBuyersQuery, type EventBuyer } from '@/store/api/organizerApi';
import { AppText, GlassInput, PressableScale, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';

const REASON_MAX = 300;

function buyerName(buyer: EventBuyer): string {
  return buyer.display_name?.trim() || buyer.name?.trim() || `${buyer.first_name ?? ''} ${buyer.last_name ?? ''}`.trim() || buyer.email?.split('@')[0] || 'Unknown';
}

export interface CancelEventSheetProps {
  eventId: number;
  eventTitle: string;
  onClose: () => void;
  onCancelled: () => void;
}

export function CancelEventSheet({ eventId, eventTitle, onClose, onCancelled }: CancelEventSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [cancelEvent, { isLoading }] = useCancelEventMutation();
  const { data: buyersData, isLoading: buyersLoading } = useGetEventBuyersQuery({ eventId, page: 1, search: '', attendance: 'all' });

  const buyers = useMemo(() => (buyersData?.results ?? []).filter((buyer) => buyer.user_type === 'buyer'), [buyersData]);
  const visibleBuyers = showAll ? buyers : buyers.slice(0, 2);
  const isConfirmValid = confirmText.trim().toLowerCase() === 'cancel' && reason.trim().length > 0;

  const submit = async () => {
    if (!isConfirmValid || isLoading) return;
    setError('');
    try {
      await cancelEvent({ eventId, reason: reason.trim() }).unwrap();
      haptics.success();
      toast(t('Event has been successfully cancelled. Attendees will be notified via email.'), 'success');
      onCancelled();
    } catch (err) {
      haptics.error();
      setError(extractApiError(err) ?? t('Failed to cancel event'));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={isLoading ? undefined : onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View className="rounded-t-[24px] bg-app-bg px-5 pt-4 dark:bg-dark-bg" style={{ paddingBottom: insets.bottom + 12, maxHeight: windowHeight * 0.88 }}>
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-danger/10">
                  <AlertTriangle size={18} color={colors.danger} />
                </View>
                <AppText className="font-gilroy-bold text-[20px]">{t('Cancel Event')}</AppText>
              </View>
              <PressableScale onPress={onClose} disabled={isLoading} accessibilityLabel={t('Close')} className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
                <X size={18} color={colors.muted} />
              </PressableScale>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-4">
                <View className="gap-1.5 rounded-[12px] bg-danger/10 px-4 py-3">
                  <AppText className="font-gilroy-bold text-[14px] text-danger dark:text-danger">{t('Warning: This action cannot be undone')}</AppText>
                  <AppText className="font-gilroy-medium text-[13px] leading-[19px] text-primary/80 dark:text-dark-text/80">
                    {t('Cancelling this event will:')}
                    {'\n'}• {t('Stop all ticket sales immediately')}
                    {'\n'}• {t('Notify all attendees via email')}
                    {'\n'}• {t('Process refunds (if applicable)')}
                    {'\n'}• {t('Remove the event from public listings')}
                  </AppText>
                </View>

                <View className="rounded-[12px] border px-4 py-3" style={{ borderColor: cardBorder }}>
                  <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('Event to cancel:')}</AppText>
                  <AppText className="mt-0.5 font-gilroy-bold text-[15px]">“{eventTitle}”</AppText>
                </View>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <AppText className="font-gilroy-semibold text-[14px]">{t('Customers to be refunded:')}</AppText>
                    {!buyersLoading && buyers.length > 0 ? (
                      <View className="rounded-full bg-black/[0.06] px-2.5 py-0.5 dark:bg-white/10">
                        <AppText className="font-gilroy-bold text-[12px]">{buyers.length}</AppText>
                      </View>
                    ) : null}
                  </View>
                  {buyersLoading ? (
                    <ActivityIndicator color={colors.muted} />
                  ) : buyers.length === 0 ? (
                    <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('No customers to refund.')}</AppText>
                  ) : (
                    <View className="gap-2">
                      {visibleBuyers.map((buyer, index) => (
                        <View key={`${buyer.order_id ?? buyer.id ?? index}`} className="flex-row items-center justify-between gap-3 rounded-[10px] bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]">
                          <View className="flex-1">
                            <AppText numberOfLines={1} className="font-gilroy-semibold text-[13px]">{buyerName(buyer)}</AppText>
                            <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{buyer.email || '-'}</AppText>
                          </View>
                          <View className="items-end">
                            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
                              {buyer.ticket_count ?? 0} × {buyer.ticket_name || t('ticket')}
                            </AppText>
                            <AppText className="font-gilroy-bold text-[13px]">
                              {buyer.currency ?? ''}{formatMoney(Number(buyer.total_price) || 0)}
                            </AppText>
                          </View>
                        </View>
                      ))}
                      {!showAll && buyers.length > 2 ? (
                        <PressableScale onPress={() => setShowAll(true)} accessibilityLabel={t('View all customers')} className="self-start">
                          <AppText className="font-gilroy-semibold text-[13px] text-links">{t('View all {{count}} customers', { count: buyers.length })}</AppText>
                        </PressableScale>
                      ) : null}
                    </View>
                  )}
                </View>

                <GlassInput
                  label={t('To confirm, type "cancel" in the box below:')}
                  placeholder={t("Type 'cancel' to confirm")}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <View className="gap-1">
                  <GlassInput
                    label={`${t('Please provide a reason for cancellation')} *`}
                    placeholder={t('e.g. Unexpected circumstances, low attendance, weather issues')}
                    value={reason}
                    onChangeText={(next) => setReason(next.slice(0, REASON_MAX))}
                    editable={!isLoading}
                  />
                  <View className="flex-row items-center justify-between">
                    <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{t('This reason will be sent to attendees.')}</AppText>
                    <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{reason.length}/{REASON_MAX}</AppText>
                  </View>
                </View>
                {error ? <AppText className="font-gilroy-medium text-[13px] text-danger dark:text-danger">{error}</AppText> : null}
              </View>
            </ScrollView>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <PressableScale onPress={onClose} disabled={isLoading} accessibilityLabel={t('Keep Event')} className="h-[52px] w-full items-center justify-center rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface">
                  <AppText className="font-gilroy-semibold text-[16px]">{t('Keep Event')}</AppText>
                </PressableScale>
              </View>
              <View className="flex-1">
                <PressableScale
                  onPress={() => void submit()}
                  disabled={!isConfirmValid || isLoading}
                  accessibilityLabel={t('Cancel Event')}
                  className={cn('h-[52px] w-full items-center justify-center rounded-[12px] bg-danger', (!isConfirmValid || isLoading) && 'opacity-50')}
                >
                  {isLoading ? <ActivityIndicator color={colors.white} /> : <AppText className="font-gilroy-semibold text-[16px] text-white dark:text-white">{t('Cancel Event')}</AppText>}
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
