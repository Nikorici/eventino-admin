import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, Line as SvgLine, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { Locale } from 'date-fns';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  ScanLine,
  Ticket,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { dateFnsLocale } from '@/lib/format';
import {
  buildTimelineSlots,
  dateKey,
  parseBoundaryDate,
  periodRangeLabel,
  shiftAnchor,
  startOfDay,
  windowRange,
  type ChartLifecycle,
  type ChartViewMode,
} from '@/lib/analyticsRange';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatMoney } from '@/lib/pricing';
import { colors, currencySymbol } from '@/theme/colors';
import { baseApi } from '@/store/api/baseApi';
import {
  useGetOrganizerGraphQuery,
  useGetOrganizerStatsQuery,
  type OrganizerGraphPoint,
  type OrganizerStatsBucket,
} from '@/store/api/organizerApi';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';

export const CARD_BORDER = '#e6edff';
const ACCENT_BLUE = '#61859d';
const ACCENT_GREEN = '#34c759';
const INCOME_COLOR = '#d97706';
const CHART_HEIGHT = 180;
const MINI_HEIGHT = 30;
const CHART_PAD = 12;
const TOOLTIP_WIDTH = 172;

const hourlyGraphApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrganizerHourlyGraph: builder.query<OrganizerGraphPoint[], { targetDate: string; eventId?: number }>({
      query: ({ targetDate, eventId }) => ({
        url: '/api/v1/statistics/get-stats-graph/',
        method: 'POST',
        body: { time_interval: 'hour', target_date: targetDate, ...(eventId != null ? { event_id: eventId } : {}) },
      }),
      transformResponse: (response: OrganizerGraphPoint[] | { results?: OrganizerGraphPoint[] }) =>
        Array.isArray(response) ? response : (response?.results ?? []),
    }),
  }),
  overrideExisting: false,
});

const { useGetOrganizerHourlyGraphQuery } = hourlyGraphApi;

export type IntervalKey = 'all_time' | 'this_week' | 'previous_week';

interface CurrencyEntry {
  code: string;
  amount: number;
}

function currencyEntries(byCurrency: Record<string, number> | undefined, codes: string[]): CurrencyEntry[] {
  const map = byCurrency ?? {};
  const keys = codes.length ? codes : Object.keys(map);
  if (keys.length === 0) return [];
  return keys.map((code) => ({ code, amount: map[code] ?? 0 }));
}

function IntervalSelector({ value, onChange }: { value: IntervalKey; onChange: (next: IntervalKey) => void }) {
  const { t } = useTranslation();
  const options: { key: IntervalKey; label: string }[] = [
    { key: 'all_time', label: t('All Time') },
    { key: 'this_week', label: t('This Week') },
    { key: 'previous_week', label: t('Previous Week') },
  ];
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <View key={option.key} className="flex-1">
            <PressableScale
              onPress={() => onChange(option.key)}
              accessibilityLabel={option.label}
              className={cn(
                'h-9 w-full items-center justify-center rounded-[8px] border',
                active ? 'border-primary bg-primary' : 'border-[#e1e4e8] bg-[#f4f5f7] dark:border-dark-border dark:bg-dark-elevated',
              )}
            >
              <AppText
                numberOfLines={1}
                className={cn('font-gilroy-semibold text-[12px]', active ? 'text-white' : 'text-primary/70')}
              >
                {option.label}
              </AppText>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

function CountCard({
  icon: Icon,
  label,
  value,
  caption,
  allTimeValue,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  caption?: string;
  allTimeValue?: number;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="w-[48%] rounded-[12px] border bg-white dark:bg-dark-surface p-4" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start justify-between">
        <AppText className="font-gilroy-bold text-[22px] leading-[26px] text-primary">{value}</AppText>
        <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${ACCENT_BLUE}1a` }}>
          <Icon size={17} color={ACCENT_BLUE} />
        </View>
      </View>
      <AppText numberOfLines={2} className="mt-1.5 font-gilroy-semibold text-[12px]" style={{ color: ACCENT_BLUE }}>
        {label}
      </AppText>
      {allTimeValue != null ? (
        <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[11px] text-muted">
          {`↗ ${allTimeValue} ${t('all time')}`}
        </AppText>
      ) : caption ? (
        <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[11px] text-muted">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

function RevenueCard({
  icon: Icon,
  label,
  entries,
  invoiceByCurrency,
  allTimeEntries,
  note,
}: {
  icon: LucideIcon;
  label: string;
  entries: CurrencyEntry[];
  invoiceByCurrency?: Record<string, number>;
  allTimeEntries?: CurrencyEntry[];
  note?: string;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const primary = entries[0];
  const rest = entries.slice(1);
  const invoiceSuffix = (code: string) => {
    const amount = invoiceByCurrency?.[code];
    return amount != null ? ` (${currencySymbol(code)} ${formatMoney(amount)})` : '';
  };
  const allTimeLine = allTimeEntries?.length
    ? allTimeEntries.map((entry) => `${currencySymbol(entry.code)} ${formatMoney(entry.amount)}`).join(' · ')
    : null;
  return (
    <View className="w-[48%] rounded-[12px] border bg-white dark:bg-dark-surface p-4" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            className="font-gilroy-bold text-[20px] leading-[24px] text-primary"
          >
            {primary ? `${currencySymbol(primary.code)} ${formatMoney(primary.amount)}${invoiceSuffix(primary.code)}` : '—'}
          </AppText>
          {rest.map((entry) => (
            <AppText key={entry.code} numberOfLines={1} className="mt-0.5 font-gilroy-semibold text-[13px] text-primary/60">
              {`${currencySymbol(entry.code)} ${formatMoney(entry.amount)}${invoiceSuffix(entry.code)}`}
            </AppText>
          ))}
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${ACCENT_GREEN}1a` }}>
          <Icon size={17} color={ACCENT_GREEN} />
        </View>
      </View>
      <AppText numberOfLines={2} className="mt-1.5 font-gilroy-semibold text-[12px]" style={{ color: ACCENT_GREEN }}>
        {label}
      </AppText>
      {allTimeLine ? (
        <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[11px] text-muted">
          {`↗ ${allTimeLine} ${t('all time')}`}
        </AppText>
      ) : null}
      {note ? <AppText className="mt-0.5 font-gilroy-medium text-[11px] text-muted">{note}</AppText> : null}
    </View>
  );
}

function StatsGrid({
  bucket,
  allTime,
  interval,
  currencies,
}: {
  bucket: OrganizerStatsBucket | undefined;
  allTime: OrganizerStatsBucket | undefined;
  interval: IntervalKey;
  currencies: string[];
}) {
  const { t } = useTranslation();
  const showAllTime = interval !== 'all_time';
  const revenueEntries = currencyEntries(bucket?.income_by_currency, currencies);
  const revenueAllTime = showAllTime ? currencyEntries(allTime?.income_by_currency, currencies) : undefined;
  const receivedEntries = currencyEntries(bucket?.total_received_by_currency, currencies);
  const receivedAllTime = showAllTime ? currencyEntries(allTime?.total_received_by_currency, currencies) : undefined;
  const allTimeTickets = allTime?.total_tickets ?? 0;
  const allTimeManual = allTime?.manual_tickets_count ?? 0;
  const paidTickets = Math.max(0, allTimeTickets - allTimeManual);
  const allTimeCaption = t('all time');

  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      <RevenueCard icon={Wallet} label={t('Total Revenue')} entries={revenueEntries} allTimeEntries={revenueAllTime} />
      <RevenueCard
        icon={Banknote}
        label={t('Total Received')}
        entries={receivedEntries}
        invoiceByCurrency={bucket?.invoice_income_by_currency}
        allTimeEntries={receivedAllTime}
        note={t('Without invoices')}
      />
      <CountCard
        icon={Users}
        label={t('Total Users')}
        value={bucket?.new_users ?? 0}
        allTimeValue={showAllTime ? (allTime?.new_users ?? 0) : undefined}
      />
      <CountCard
        icon={CheckCircle2}
        label={t('Tickets sold')}
        value={bucket?.tickets_sold ?? 0}
        allTimeValue={showAllTime ? (allTime?.tickets_sold ?? 0) : undefined}
      />
      <CountCard icon={Ticket} label={t('Total Tickets')} value={allTimeTickets} caption={allTimeCaption} />
      <CountCard icon={ScanLine} label={t('Scanned Tickets')} value={allTime?.scanned_tickets ?? 0} caption={allTimeCaption} />
      <CountCard icon={XCircle} label={t('Not Scanned Tickets')} value={allTime?.not_scanned_tickets ?? 0} caption={allTimeCaption} />
      <CountCard icon={CreditCard} label={t('Paid Tickets')} value={paidTickets} caption={allTimeCaption} />
      <CountCard icon={Gift} label={t('Free Tickets')} value={allTimeManual} caption={allTimeCaption} />
    </View>
  );
}

function StatCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="w-[48%] rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-9 w-9 rounded-[10px]" />
      </View>
      <Skeleton className="mt-2 h-3 w-24" />
      <Skeleton className="mt-1.5 h-2.5 w-20" />
    </View>
  );
}

export function DashboardStatsSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3">
      <Skeleton className="h-9 w-full rounded-[8px]" />
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <StatCardSkeleton key={key} />
        ))}
      </View>
      <View className="rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-28 rounded-[7px]" />
        </View>
        <Skeleton className="mt-3 h-8 w-full rounded-[8px]" />
        <Skeleton className="mt-3 w-full rounded-[10px]" style={{ height: CHART_HEIGHT }} />
      </View>
    </View>
  );
}

type ChartSeriesKey = 'income' | 'new_users' | 'tickets_sold' | 'favorited_by';

const CHART_SERIES: { key: ChartSeriesKey; color: string; label: string }[] = [
  { key: 'income', color: INCOME_COLOR, label: 'Total Revenue' },
  { key: 'new_users', color: '#2563eb', label: 'Total Users' },
  { key: 'tickets_sold', color: '#059669', label: 'Tickets sold' },
  { key: 'favorited_by', color: '#7c3aed', label: 'Favorites' },
];

const CHART_VIEW_MODES: { key: ChartViewMode; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
];

const EMPTY_GRAPH: OrganizerGraphPoint[] = [];

interface ChartPoint {
  key: string;
  tooltipLabel: string;
  axisLabel: string;
  income: number;
  new_users: number;
  tickets_sold: number;
  favorited_by: number;
}

function pointBucketKey(point: OrganizerGraphPoint, mode: ChartViewMode): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}))?/.exec(point.date);
  if (!match) return null;
  if (mode === 'day') return match[2] ? `${match[1]}-${match[2]}` : null;
  return match[1];
}

function dominantCurrency(eventCurrencies: string[], points: OrganizerGraphPoint[]): string | null {
  if (eventCurrencies.length) {
    const counts = new Map<string, number>();
    for (const code of eventCurrencies) counts.set(code, (counts.get(code) ?? 0) + 1);
    let best: string | null = null;
    let bestCount = 0;
    for (const code of eventCurrencies) {
      const count = counts.get(code) ?? 0;
      if (count > bestCount) {
        best = code;
        bestCount = count;
      }
    }
    return best;
  }
  for (const point of points) {
    const codes = Object.keys(point.income_by_currency ?? {});
    if (codes.length) return codes[0];
  }
  return null;
}

function buildWindowPoints(
  mode: ChartViewMode,
  anchor: Date,
  source: OrganizerGraphPoint[],
  currency: string | null,
  locale: Locale,
  lifecycle?: ChartLifecycle | null,
): ChartPoint[] {
  const slots = buildTimelineSlots(mode, anchor, locale, lifecycle);
  const totals = new Map<string, { income: number; new_users: number; tickets_sold: number; favorited_by: number }>();
  for (const slot of slots) totals.set(slot.key, { income: 0, new_users: 0, tickets_sold: 0, favorited_by: 0 });
  for (const point of source) {
    const key = pointBucketKey(point, mode);
    if (!key) continue;
    const slotTotals = totals.get(key);
    if (!slotTotals) continue;
    slotTotals.income += currency ? (point.income_by_currency?.[currency] ?? 0) : 0;
    slotTotals.new_users += Number(point.new_users) || 0;
    slotTotals.tickets_sold += Number(point.tickets_sold) || 0;
    slotTotals.favorited_by += Number(point.favorited_by) || 0;
  }
  return slots.map((slot) => ({
    ...slot,
    ...(totals.get(slot.key) ?? { income: 0, new_users: 0, tickets_sold: 0, favorited_by: 0 }),
  }));
}

function seriesPath(values: number[], width: number, height: number, pad: number, area: boolean): string {
  const n = values.length;
  if (n === 0 || width <= 0) return '';
  const max = Math.max(...values, 1);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const points = values.map((value, index) => [pad + index * stepX, pad + innerH * (1 - value / max)] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  if (!area || points.length === 0) return line;
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last[0].toFixed(1)},${(height - pad).toFixed(1)} L${first[0].toFixed(1)},${(height - pad).toFixed(1)} Z`;
}

export const AnalyticsChart = memo(function AnalyticsChart({
  eventId,
  currencies,
  lifecycle,
}: {
  eventId?: number;
  currencies: string[];
  lifecycle?: ChartLifecycle | null;
}) {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<ChartViewMode>('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const lifecycleEndMs = lifecycle?.end?.getTime() ?? null;

  useEffect(() => {
    if (lifecycleEndMs == null) return;
    setAnchor((current) => (current.getTime() > lifecycleEndMs ? new Date(lifecycleEndMs) : current));
  }, [lifecycleEndMs]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [miniWidth, setMiniWidth] = useState(0);

  const { data: dailyData, isLoading: dailyLoading } = useGetOrganizerGraphQuery({ interval: 'day', eventId });
  const { data: hourlyData, isLoading: hourlyLoading } = useGetOrganizerHourlyGraphQuery(
    { targetDate: dateKey(anchor), eventId },
    { skip: viewMode !== 'day' },
  );

  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const gridStroke = useThemeColor('#e6edff', colors.dark.border);
  const chevronColor = useThemeColor(colors.primary, colors.dark.text);

  const locale = dateFnsLocale(i18n.language);
  const source = (viewMode === 'day' ? hourlyData : dailyData) ?? EMPTY_GRAPH;
  const isLoading = viewMode === 'day' ? hourlyLoading : dailyLoading;

  const currency = useMemo(() => dominantCurrency(currencies, dailyData ?? EMPTY_GRAPH), [currencies, dailyData]);

  const points = useMemo(
    () => buildWindowPoints(viewMode, anchor, source, currency, locale, lifecycle),
    [viewMode, anchor, source, currency, locale, lifecycle],
  );

  useEffect(() => {
    setSelectedIndex(null);
  }, [viewMode, anchor, source]);

  const paths = useMemo(
    () => ({
      area: seriesPath(points.map((point) => point.income), width, CHART_HEIGHT, CHART_PAD, true),
      lines: CHART_SERIES.filter((series) => series.key === 'income').map((series) => ({
        key: series.key,
        color: series.color,
        d: seriesPath(points.map((point) => point[series.key]), width, CHART_HEIGHT, CHART_PAD, false),
      })),
    }),
    [points, width],
  );

  const axisLabels = useMemo(() => {
    if (points.length === 0) return [];
    const count = Math.min(5, points.length);
    if (count === 1) return [points[0].axisLabel];
    const step = (points.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, index) => points[Math.round(index * step)].axisLabel);
  }, [points]);

  const periodTotal = useMemo(() => points.reduce((sum, point) => sum + point.income, 0), [points]);

  const countSeries = useMemo(
    () =>
      CHART_SERIES.filter((series) => series.key !== 'income').map((series) => ({
        ...series,
        total: points.reduce((sum, point) => sum + point[series.key], 0),
        d: seriesPath(points.map((point) => point[series.key]), miniWidth, MINI_HEIGHT, 3, false),
      })),
    [points, miniWidth],
  );
  const rangeLabel = periodRangeLabel(viewMode, anchor, locale);

  const today = startOfDay(new Date());
  const currentWindow = windowRange(viewMode, anchor);
  const lastReachable = lifecycle?.end && lifecycle.end < today ? lifecycle.end : today;
  const nextDisabled = currentWindow.end.getTime() >= lastReachable.getTime();
  const prevDisabled = lifecycle?.start != null && currentWindow.start.getTime() <= lifecycle.start.getTime();

  const goPrev = () => {
    if (prevDisabled) return;
    haptics.light();
    setAnchor((current) => shiftAnchor(viewMode, current, -1));
  };

  const goNext = () => {
    if (nextDisabled) return;
    haptics.light();
    setAnchor((current) => shiftAnchor(viewMode, current, 1));
  };

  const handleChartPress = (locationX: number) => {
    if (points.length === 0 || width <= 0) return;
    const stepX = points.length > 1 ? (width - CHART_PAD * 2) / (points.length - 1) : 1;
    const index = Math.min(points.length - 1, Math.max(0, Math.round((locationX - CHART_PAD) / stepX)));
    haptics.selection();
    setSelectedIndex((current) => (current === index ? null : index));
  };

  const selected = selectedIndex != null && selectedIndex < points.length ? points[selectedIndex] : null;
  const chartStepX = points.length > 1 ? (width - CHART_PAD * 2) / (points.length - 1) : 0;
  const selectedX = selectedIndex != null ? CHART_PAD + selectedIndex * chartStepX : 0;
  const tooltipLeft = Math.min(Math.max(selectedX - TOOLTIP_WIDTH / 2, 0), Math.max(width - TOOLTIP_WIDTH, 0));

  return (
    <View className="rounded-[12px] border bg-white dark:bg-dark-surface p-4" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between">
        <AppText className="font-gilroy-bold text-[16px]">{t('Event Analytics')}</AppText>
        <View className="flex-row gap-1">
          {CHART_VIEW_MODES.map((option) => {
            const active = viewMode === option.key;
            return (
              <PressableScale
                key={option.key}
                onPress={() => setViewMode(option.key)}
                accessibilityLabel={t(option.label)}
                className={cn('rounded-[7px] px-2.5 py-1', active ? 'bg-primary' : 'bg-[#f4f5f7] dark:bg-dark-elevated')}
              >
                <AppText className={cn('font-gilroy-semibold text-[11px]', active ? 'text-white' : 'text-primary/60')}>
                  {t(option.label)}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between gap-2">
        <PressableScale
          onPress={goPrev}
          disabled={prevDisabled}
          hitSlop={8}
          accessibilityLabel={t('Previous period')}
          className={cn(
            'h-8 w-8 items-center justify-center rounded-[8px] bg-[#f4f5f7] dark:bg-dark-elevated',
            prevDisabled ? 'opacity-40' : '',
          )}
        >
          <ChevronLeft size={16} color={chevronColor} />
        </PressableScale>
        <View className="flex-1 items-center">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[13px]">
            {rangeLabel}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-bold text-[13px]" style={{ color: INCOME_COLOR }}>
            {currency ? `${currencySymbol(currency)} ${formatMoney(periodTotal)}` : formatMoney(periodTotal)}
          </AppText>
        </View>
        <PressableScale
          onPress={goNext}
          disabled={nextDisabled}
          hitSlop={8}
          accessibilityLabel={t('Next period')}
          className={cn(
            'h-8 w-8 items-center justify-center rounded-[8px] bg-[#f4f5f7] dark:bg-dark-elevated',
            nextDisabled ? 'opacity-40' : '',
          )}
        >
          <ChevronRight size={16} color={chevronColor} />
        </PressableScale>
      </View>

      <View className="mt-3" style={{ height: CHART_HEIGHT }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && !isLoading ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <SvgLinearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={INCOME_COLOR} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={INCOME_COLOR} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              {[0, 0.5, 1].map((line) => (
                <SvgLine
                  key={line}
                  x1={CHART_PAD}
                  x2={width - CHART_PAD}
                  y1={CHART_PAD + (CHART_HEIGHT - CHART_PAD * 2) * line}
                  y2={CHART_PAD + (CHART_HEIGHT - CHART_PAD * 2) * line}
                  stroke={gridStroke}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))}
              <Path d={paths.area} fill="url(#incomeFill)" stroke="none" />
              {paths.lines.map((line) => (
                <Path
                  key={line.key}
                  d={line.d}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {selected ? (
                <SvgLine
                  x1={selectedX}
                  x2={selectedX}
                  y1={CHART_PAD}
                  y2={CHART_HEIGHT - CHART_PAD}
                  stroke={ACCENT_BLUE}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              ) : null}
            </Svg>
            {points.length > 0 ? (
              <Pressable className="absolute inset-0" onPress={(event) => handleChartPress(event.nativeEvent.locationX)} />
            ) : null}
            {selected ? (
              <View
                pointerEvents="none"
                className="absolute top-1 rounded-[10px] border bg-white/95 px-3 py-2 dark:bg-dark-elevated/95"
                style={{ left: tooltipLeft, width: TOOLTIP_WIDTH, borderColor: cardBorder }}
              >
                <AppText className="font-gilroy-semibold text-[11px]">{selected.tooltipLabel}</AppText>
                {CHART_SERIES.map((series) => (
                  <View key={series.key} className="mt-1 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
                      <AppText className="font-gilroy-medium text-[10px] text-muted">{t(series.label)}</AppText>
                    </View>
                    <AppText className="font-gilroy-semibold text-[10px]">
                      {series.key === 'income'
                        ? currency
                          ? `${currencySymbol(currency)} ${formatMoney(selected.income)}`
                          : formatMoney(selected.income)
                        : String(selected[series.key])}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Skeleton className="h-full w-full rounded-[10px]" />
        )}
      </View>

      {axisLabels.length > 0 ? (
        <View className="mt-1.5 flex-row justify-between">
          {axisLabels.map((label, index) => (
            <AppText key={`${index}-${label}`} className="font-gilroy-medium text-[10px] text-muted">
              {label}
            </AppText>
          ))}
        </View>
      ) : null}

      <View
        className="mt-4 flex-row gap-2 border-t pt-4"
        style={{ borderTopColor: gridStroke }}
        onLayout={(event) => setMiniWidth((event.nativeEvent.layout.width - 16) / 3)}
      >
        {countSeries.map((series) => (
          <View key={series.key} className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[10px] text-muted">
                {t(series.label)}
              </AppText>
            </View>
            <AppText className="font-gilroy-bold text-[16px]">{Math.round(series.total)}</AppText>
            {miniWidth > 0 ? (
              <Svg width={miniWidth} height={MINI_HEIGHT}>
                <Path
                  d={series.d}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

export const DashboardStatsSection = memo(function DashboardStatsSection({
  eventId,
  lifecycleStart,
  lifecycleEnd,
}: {
  eventId?: number;
  lifecycleStart?: string | null;
  lifecycleEnd?: string | null;
}) {
  const [interval, setStatsInterval] = useState<IntervalKey>('all_time');
  const { data: stats, isLoading } = useGetOrganizerStatsQuery(eventId);

  const currencies = useMemo(() => stats?.event_currencies ?? [], [stats?.event_currencies]);
  const lifecycle = useMemo<ChartLifecycle | null>(() => {
    if (!lifecycleStart && !lifecycleEnd) return null;
    return { start: parseBoundaryDate(lifecycleStart), end: parseBoundaryDate(lifecycleEnd) };
  }, [lifecycleStart, lifecycleEnd]);

  if (isLoading) return <DashboardStatsSkeleton />;

  return (
    <View className="gap-3">
      <IntervalSelector value={interval} onChange={setStatsInterval} />
      <StatsGrid bucket={stats?.[interval]} allTime={stats?.all_time} interval={interval} currencies={currencies} />
      <AnalyticsChart eventId={eventId} currencies={currencies} lifecycle={lifecycle} />
    </View>
  );
});
