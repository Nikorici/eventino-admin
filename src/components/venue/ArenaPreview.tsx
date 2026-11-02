import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { formatMoney } from '@/lib/pricing';
import type { EventZone, VenueZone } from '@/store/api/venueApi';

const UNAVAILABLE_COLOR = '#BDC3C7';

interface ArenaPreviewProps {
  zones: VenueZone[];
  mappings: Map<number, EventZone>;
  currency: string;
}

function zonePrice(mapping: EventZone | undefined): number | null {
  const value = mapping ? (mapping.price_override ?? mapping.ticket_type_price) : null;
  return value == null || value === '' ? null : Number(value);
}

export function ArenaPreview({ zones, mappings, currency }: ArenaPreviewProps) {
  const { t } = useTranslation();
  const tiles = [...zones].reverse().map((zone) => {
    const mapping = mappings.get(zone.id);
    const available = Boolean(mapping) && (mapping?.is_active_override ?? zone.is_active);
    return { zone, color: available ? zone.color : UNAVAILABLE_COLOR, price: available ? zonePrice(mapping) : null };
  });
  const legend = tiles
    .filter((tile): tile is typeof tile & { price: number } => tile.price !== null)
    .filter((tile, index, list) => list.findIndex((item) => item.price === tile.price && item.color === tile.color) === index)
    .sort((a, b) => a.price - b.price);
  const tileWidth = tiles.length > 4 ? '48%' : '100%';

  return (
    <View className="gap-3">
      <View className="items-center gap-3 rounded-[12px] border border-black/[0.06] bg-[#f9fafb] p-4 dark:border-white/10 dark:bg-dark-elevated" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View className="mb-3 h-8 w-[220px] items-center justify-center rounded-[6px] bg-[#bebebe]">
          <AppText className="font-gilroy-semibold text-[13px] text-white">{t('Stage').toUpperCase()}</AppText>
        </View>
        <View className="w-full flex-row flex-wrap justify-between gap-y-3">
          {tiles.map(({ zone, color }) => (
            <View key={zone.id} className="h-[60px] items-center justify-center rounded-[12px] px-3" style={{ width: tileWidth, backgroundColor: color, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px] text-white">
                {zone.name}
              </AppText>
              {zone.comment ? (
                <AppText numberOfLines={1} className="font-gilroy text-[11px] text-white/85">
                  {zone.comment}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      </View>
      <View className="flex-row flex-wrap justify-center gap-x-3 gap-y-2">
        {legend.map((item) => (
          <View key={`${item.price}-${item.color}`} className="flex-row items-center gap-1.5">
            <View className="h-3 w-3 rounded-full border border-[#e5e7eb]" style={{ backgroundColor: item.color }} />
            <AppText className="font-gilroy-medium text-[12px] text-primary/80 dark:text-dark-text/80">{`${formatMoney(item.price)} ${currency}`}</AppText>
          </View>
        ))}
        <View className="flex-row items-center gap-1.5">
          <View className="h-3 w-3 rounded-full border border-[#e5e7eb]" style={{ backgroundColor: UNAVAILABLE_COLOR }} />
          <AppText className="font-gilroy-medium text-[12px] text-primary/80 dark:text-dark-text/80">{t('Unavailable')}</AppText>
        </View>
      </View>
    </View>
  );
}
