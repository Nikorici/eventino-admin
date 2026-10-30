import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
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
const MAP_PAD = 32;
const MARKER_COLOR = '#6366f1';

const cityKey = (row: BuyerCity) => `${row.city}|${row.country}`;
const cityLabel = (row: BuyerCity) => [row.city, row.country].filter(Boolean).join(', ');

function BuyerMap({ cities }: { cities: BuyerCity[] }) {
  const [width, setWidth] = useState(0);
  const mapFill = useThemeColor('#eef0f3', colors.dark.elevated);
  const markerStroke = useThemeColor('#ffffff', colors.dark.surface);
  const markers = useMemo(() => projectCities(cities, width, MAP_HEIGHT, MAP_PAD), [cities, width]);
  const labels = useMemo(() => placeLabels(markers.slice(0, LABELLED_CITIES), width), [markers, width]);

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
        <AppText className="font-gilroy-semibold text-[15px]">{t('Buyer locations')}</AppText>
      </View>
      <AppText className="mt-1.5 font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
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
          <AppText className="mt-4 font-gilroy-semibold text-[15px]">{t('Top cities')}</AppText>
          <View className="mt-1 flex-row border-b py-2" style={{ borderColor: cardBorder }}>
            <AppText className="flex-1 font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{t('City')}</AppText>
            <AppText className="w-16 text-right font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{t('Orders')}</AppText>
            <AppText className="w-16 text-right font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{t('Tickets')}</AppText>
          </View>
          {cities.slice(0, TOP_CITIES).map((row) => (
            <View key={cityKey(row)} className="flex-row border-b py-2.5" style={{ borderColor: divider }}>
              <AppText numberOfLines={1} className="flex-1 pr-2 font-gilroy-medium text-[13px]">
                {cityLabel(row)}
              </AppText>
              <AppText className="w-16 text-right font-gilroy-semibold text-[13px]">{row.orders}</AppText>
              <AppText className="w-16 text-right font-gilroy-medium text-[13px]">{row.tickets}</AppText>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
