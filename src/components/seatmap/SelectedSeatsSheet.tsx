import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Armchair, Timer, X } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { formatCountdown } from '@/lib/seating/countdown';
import { formatPrice, parsePrice, selectionTotal } from '@/lib/seating/pricing';
import { formatSeatLine } from '@/lib/seating/seatLabel';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { PricedHoldSeat } from '@/types/seating';
import { AppText, GlassButton, PressableScale } from '@/components/ui';

export interface SelectedSeatsListProps {
  seats: PricedHoldSeat[];
  currency: string;
  remainingSeconds: number | null;
  continueDisabled: boolean;
  onRemove: (seatId: number) => void;
  onClear: () => void;
  onContinue: () => void;
}

export interface SelectedSeatsSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export function SelectedSeatsList({
  seats,
  currency,
  remainingSeconds,
  continueDisabled,
  onRemove,
  onClear,
  onContinue,
}: SelectedSeatsListProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const iconColor = isDark ? colors.dark.text : colors.primary;
  const total = formatPrice(selectionTotal(seats), currency);

  return (
    <View className="gap-4 px-5 pt-2">
      <View className="flex-row items-center justify-between">
        <AppText className="font-gilroy-bold text-2xl">{t('Your seats')}</AppText>
        {remainingSeconds != null ? (
          <View
            accessibilityLabel={t('Seats held for {{time}}', { time: formatCountdown(remainingSeconds) })}
            className="flex-row items-center gap-1.5 rounded-full bg-checkout-indigo-bg px-3 py-1.5 dark:bg-white/10"
          >
            <Timer size={14} color={colors.checkoutIndigo} />
            <AppText className="font-gilroy-semibold text-[13px] text-checkout-indigo dark:text-checkout-indigo">
              {formatCountdown(remainingSeconds)}
            </AppText>
          </View>
        ) : null}
      </View>

      {seats.length === 0 ? (
        <View className="items-center gap-2 py-8">
          <Armchair size={28} color={colors.muted} />
          <AppText className="font-gilroy-semibold text-base">{t('No seats selected yet')}</AppText>
          <AppText className="text-center font-gilroy text-sm text-muted dark:text-dark-muted">
            {t('Tap a seat on the map to select it')}
          </AppText>
        </View>
      ) : (
        <View className="gap-2">
          {seats.map((seat) => (
            <View
              key={seat.seat_id}
              className="flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface"
            >
              <View className="flex-1 gap-0.5">
                <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
                  {formatSeatLine(seat, t)}
                </AppText>
                <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
                  {`${seat.ticket_type_name} · ${formatPrice(parsePrice(seat.price), currency)}`}
                </AppText>
              </View>
              <PressableScale
                onPress={() => {
                  haptics.selection();
                  onRemove(seat.seat_id);
                }}
                hitSlop={8}
                accessibilityLabel={`${t('Remove seat')} ${formatSeatLine(seat, t)}`}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
              >
                <X size={16} color={iconColor} />
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      <View className="h-px bg-app-border dark:bg-dark-border" />

      <View className="flex-row items-center justify-between">
        <AppText className="font-gilroy-medium text-[15px] text-primary/70 dark:text-dark-text/70">
          {seats.length === 1 ? t('1 seat selected') : t('{{count}} seats selected', { count: seats.length })}
        </AppText>
        <AppText className="font-gilroy-bold text-xl">{total}</AppText>
      </View>

      <View className="gap-2.5 pt-1">
        <GlassButton label={t('Continue')} onPress={onContinue} disabled={continueDisabled} />
        {seats.length > 0 ? <GlassButton label={t('Clear selection')} variant="ghost" onPress={onClear} /> : null}
      </View>
    </View>
  );
}

export const SelectedSeatsSheet = forwardRef<SelectedSeatsSheetHandle, SelectedSeatsListProps>(
  function SelectedSeatsSheet(props, ref) {
    const modalRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const snapPoints = useMemo(() => ['60%', '88%'], []);

    useImperativeHandle(ref, () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    }));

    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={modalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
        backgroundStyle={{ backgroundColor: isDark ? colors.dark.surface : colors.surface }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <SelectedSeatsList {...props} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
