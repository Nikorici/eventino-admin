import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { AppText, EmptyState, Skeleton } from '@/components/ui';
import type { BuyerCity, BuyerLocations } from '@/store/api/trackingApi';

import { placeLabels, projectCities } from './trafficSources';

const TOP_CITIES = 8;
const LABELLED_CITIES = 5;
const MAP_HEIGHT = 220;
const MAP_PAD = 22;
const MARKER_COLOR = '#6366f1';
const ART_WIDTH = 324;
const RIVER_PATHS = [
  'M140 0 C150 40 168 60 172 92 S181 128 183 146 C196 150 212 148 242 162',
  'M20 214 C70 212 130 216 160 208 C176 200 182 176 183 146',
  'M196 0 C206 26 222 44 238 70 C248 86 258 98 270 108',
];
const ROAD_PATH = 'M0 120 C60 112 110 132 150 120 M60 0 C80 60 100 140 90 220';
const SEA_PATH = 'M204 220 C208 204 222 184 242 162 C252 140 262 112 284 90 C300 84 312 82 324 80 L324 220 Z';

const cityKey = (row: BuyerCity) => `${row.city}|${row.country}`;
const cityLabel = (row: BuyerCity) => [row.city, row.country].filter(Boolean).join(', ');

function BuyerMap({ cities }: { cities: BuyerCity[] }) {
  const [width, setWidth] = useState(0);
  const mapFill = useThemeColor('#eef0f3', colors.dark.elevated);
  const markerStroke = useThemeColor('#ffffff', colors.dark.surface);
  const seaFill = useThemeColor('#dce5ed', 'rgba(97,133,157,0.18)');
  const riverStroke = useThemeColor('#d7e0e8', colors.dark.border);
  const roadStroke = useThemeColor('#e4e7eb', colors.dark.border);
  const markers = useMemo(() => projectCities(cities, width, MAP_HEIGHT, MAP_PAD), [cities, width]);
  const labels = useMemo(() => placeLabels(markers, width, LABELLED_CITIES), [markers, width]);

  return (
    <View
      className="mt-3.5 overflow-hidden rounded-[10px]"
      style={{ height: MAP_HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="image"
      accessibilityLabel={cities.map(cityLabel).slice(0, LABELLED_CITIES).join(', ')}
    >
      {width > 0 ? (
        <Svg width={width} height={MAP_HEIGHT}>
          <Rect width={width} height={MAP_HEIGHT} fill={mapFill} />
          <G transform={`scale(${width / ART_WIDTH} 1)`}>
            <Path d={SEA_PATH} fill={seaFill} />
            {RIVER_PATHS.map((d) => (
              <Path key={d} d={d} fill="none" stroke={riverStroke} strokeWidth={2} />
            ))}
            <Path d={ROAD_PATH} fill="none" stroke={roadStroke} strokeWidth={1.5} />
          </G>
          {markers.map((marker) => (
            <Circle
              key={marker.key}
              cx={marker.x}
              cy={marker.y}
              r={marker.r}
              fill={MARKER_COLOR}
              fillOpacity={0.55}
              stroke={markerStroke}
              strokeWidth={1.5}
            />
          ))}
          {labels.map((label) => (
            <SvgText
              key={`label-${label.key}`}
              x={label.x}
              y={label.y}
              fontSize={9}
              fontWeight="600"
              fill={colors.muted}
              textAnchor={label.anchor}
            >
              {label.text}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

export function BuyerLocationsCard({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: BuyerLocations | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const divider = useThemeColor('#f0f2f8', colors.dark.border);
  const cities = data?.cities ?? [];

  return (
    <View className="mt-1 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center gap-2">
        <MapPin size={16} color={colors.accent} />
        <AppText className="font-gilroy-semibold text-[15px] leading-5">{t('Buyer locations')}</AppText>
      </View>
      <AppText className="mt-1.5 font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
        {t("Approximate city of each paid order, based on the buyer's connection")}
      </AppText>
      {data && data.total_paid > 0 ? (
        <View className="mt-2.5 h-6 self-start justify-center rounded-[6px] bg-black/[0.04] px-2 dark:bg-white/10">
          <AppText className="font-gilroy-semibold text-[12px] text-primary/80 dark:text-dark-text/80">
            {t('Located {{located}} of {{total}} orders', { located: data.total_located, total: data.total_paid })}
          </AppText>
        </View>
      ) : null}

      {isLoading ? (
        <Skeleton className="mt-3.5 h-[220px] w-full rounded-[10px]" />
      ) : isError ? (
        <EmptyState icon={MapPin} title={t('Something went wrong.')} actionLabel={t('Try again')} onAction={onRetry} />
      ) : cities.length === 0 ? (
        <EmptyState icon={MapPin} title={t('Locations are collected for new orders')} />
      ) : (
        <>
          <BuyerMap cities={cities} />
          <AppText className="mt-4 font-gilroy-semibold text-[15px] leading-5">{t('Top cities')}</AppText>
          <View className="mt-1 flex-row border-b py-2" style={{ borderColor: cardBorder }}>
            <AppText className="flex-1 font-gilroy-semibold text-[12px] leading-4 text-muted dark:text-dark-muted">
              {t('City')}
            </AppText>
            <AppText className="w-16 text-right font-gilroy-semibold text-[12px] leading-4 text-muted dark:text-dark-muted">
              {t('Orders')}
            </AppText>
            <AppText className="w-16 text-right font-gilroy-semibold text-[12px] leading-4 text-muted dark:text-dark-muted">
              {t('Tickets')}
            </AppText>
          </View>
          {cities.slice(0, TOP_CITIES).map((row) => (
            <View key={cityKey(row)} className="flex-row border-b py-2.5" style={{ borderColor: divider }}>
              <AppText numberOfLines={1} className="flex-1 pr-2 font-gilroy-medium text-[13px] leading-[17px]">
                {cityLabel(row)}
              </AppText>
              <AppText className="w-16 text-right font-gilroy-medium text-[13px] leading-[17px]">{row.orders}</AppText>
              <AppText className="w-16 text-right font-gilroy-medium text-[13px] leading-[17px]">{row.tickets}</AppText>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
