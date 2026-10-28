import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatPrice, parsePrice } from '@/lib/seating/pricing';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SeatCategory } from '@/types/seating';
import { AppText } from '@/components/ui';

import { seatMapTheme } from './seatColors';

export interface SeatLegendProps {
  categories: SeatCategory[];
  currency: string;
}

function LegendChip({ color, label, ring }: { color: string; label: string; ring?: string }) {
  return (
    <View
      accessibilityLabel={label}
      className="h-9 flex-row items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface"
    >
      <View
        className="h-3.5 w-3.5 rounded-full"
        style={{ backgroundColor: color, borderWidth: ring ? 2 : 0, borderColor: ring }}
      />
      <AppText numberOfLines={1} className="font-gilroy-medium text-[13px]">
        {label}
      </AppText>
    </View>
  );
}

export function SeatLegend({ categories, currency }: SeatLegendProps) {
  const { t } = useTranslation();
  const theme = seatMapTheme(useColorScheme() === 'dark');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      accessibilityLabel={t('Seat map legend')}
    >
      {categories.map((category) => (
        <LegendChip
          key={category.ticket_type_id}
          color={category.color}
          label={`${category.name} · ${formatPrice(parsePrice(category.price), currency)}`}
        />
      ))}
      <LegendChip color={theme.selected} ring={theme.selectedRing} label={t('Selected')} />
      <LegendChip color={theme.reserved} label={t('Reserved')} />
      <LegendChip color={theme.sold} label={t('Sold')} />
      <LegendChip color={theme.unavailable} label={t('Unavailable')} />
    </ScrollView>
  );
}
