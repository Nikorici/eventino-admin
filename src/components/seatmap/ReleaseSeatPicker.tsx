import { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { haptics } from '@/lib/haptics';
import { buildSeatIndexFromResponse, type IndexedSeat } from '@/lib/seating/seatIndex';
import { formatSeatLine } from '@/lib/seating/seatLabel';
import { categoriesById } from '@/lib/seating/selection';
import { statusMapFromBuckets } from '@/lib/seating/status';
import { useToast } from '@/hooks/useToast';
import { useGetEventSeatMapQuery } from '@/store/api/seatingApi';
import { AppText, Skeleton } from '@/components/ui';

import { SeatLegend } from './SeatLegend';
import { SeatMapCanvas } from './SeatMapCanvas';

export interface ReleaseSeatPickerProps {
  eventId: number;
  ticketTypeId: number;
  quantity: number;
  value: number[];
  currency: string;
  onChange: (seatIds: number[]) => void;
}

const CANVAS_HEIGHT = 320;

export function ReleaseSeatPicker({ eventId, ticketTypeId, quantity, value, currency, onChange }: ReleaseSeatPickerProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { data: seatMap, isLoading } = useGetEventSeatMapQuery(eventId);

  const index = useMemo(() => (seatMap ? buildSeatIndexFromResponse(seatMap) : null), [seatMap]);
  const categories = useMemo(() => categoriesById(seatMap?.categories ?? []), [seatMap]);
  const statuses = useMemo(() => statusMapFromBuckets(seatMap?.statuses ?? { sold: [], reserved: [], blocked: [], disabled: [], unavailable: [] }), [seatMap]);
  const selectedIds = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (value.length > quantity) onChange(value.slice(0, quantity));
  }, [onChange, quantity, value]);

  const onSeatPress = useCallback(
    (seat: IndexedSeat) => {
      if (selectedIds.has(seat.id)) {
        haptics.selection();
        onChange(value.filter((id) => id !== seat.id));
        return;
      }
      if (seat.ticketTypeId !== ticketTypeId) {
        haptics.warning();
        toast(t('This seat belongs to another ticket type'), 'info');
        return;
      }
      if (value.length >= quantity) {
        haptics.warning();
        toast(t('You can pick at most {{count}} seats for this row', { count: quantity }), 'info');
        return;
      }
      haptics.selection();
      onChange([...value, seat.id]);
    },
    [selectedIds, ticketTypeId, value, quantity, onChange, toast, t],
  );

  if (isLoading && !seatMap) {
    return <Skeleton className="w-full rounded-[14px]" style={{ height: CANVAS_HEIGHT }} />;
  }

  if (!seatMap || !index) {
    return (
      <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('Seat selection is not available right now')}</AppText>
    );
  }

  const chips = value
    .map((seatId) => index.seatsById.get(seatId))
    .filter((seat): seat is IndexedSeat => seat != null);

  return (
    <View className="gap-2">
      <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
        {t('{{picked}} of {{count}} seats picked', { picked: value.length, count: quantity })}
      </AppText>
      {chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map((seat) => (
            <View key={seat.id} className="rounded-full bg-black/[0.05] px-2.5 py-1 dark:bg-white/10">
              <AppText className="font-gilroy-medium text-[12px]">
                {formatSeatLine({ section_name: seat.sectionName, row_label: seat.rowLabel, seat_label: seat.label }, t)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <View className="overflow-hidden rounded-[14px] border border-app-border dark:border-dark-border" style={{ height: CANVAS_HEIGHT }}>
        <SeatMapCanvas
          index={index}
          layout={seatMap.layout}
          categories={categories}
          statuses={statuses}
          selectedSeatIds={selectedIds}
          language={i18n.language}
          onSeatPress={onSeatPress}
        />
      </View>
      <View className="-mx-4">
        <SeatLegend categories={seatMap.categories} currency={currency} />
      </View>
    </View>
  );
}
