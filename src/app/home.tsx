import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Clock,
  CreditCard,
  Gift,
  Heart,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { CARD_BORDER, type IntervalKey } from '@/components/dashboard/DashboardStats';
import { OptionSheet } from '@/components/dashboard/OptionSheet';
import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { organizerEventStatus } from '@/components/events/OrganizerEventCard';
import { AppText, Chip, EmptyState, GlassButton, GlassSurface, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { STORAGE_KEYS } from '@/lib/constants';
import { FALLBACK_RATES, SUMMARY_CURRENCIES, groupThousands, sumInCurrency } from '@/lib/currency';
import { haptics } from '@/lib/haptics';
import { href, navigate, routes } from '@/lib/nav';
import { cache } from '@/lib/storage';
import { useGetExchangeRatesQuery } from '@/store/api/currencyApi';
import { useGetOrganizerEventsQuery, useGetOrganizerStatsQuery } from '@/store/api/organizerApi';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';

const PERIODS: { value: IntervalKey; label: string }[] = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_week', label: 'This Week' },
  { value: 'previous_week', label: 'Previous Week' },
];

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  hero,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: string;
  unit?: string;
  hint?: string;
  hero?: boolean;
}) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  return (
    <View
      className={cn(
        'gap-0.5 rounded-[14px] border px-5 py-[18px]',
        hero ? 'border-primary bg-primary dark:border-white/10' : 'bg-white dark:bg-dark-surface',
      )}
      style={hero ? undefined : { borderColor: cardBorder }}
    >
      <View className={cn('flex-row justify-between gap-3', unit ? 'items-start' : 'items-center')}>
        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          className={cn(
            'shrink font-gilroy-bold tracking-tight',
            unit ? (hero ? 'text-[34px] leading-[40px]' : 'text-[32px] leading-[38px]') : 'text-[38px] leading-[44px]',
            hero && 'text-white dark:text-white',
          )}
        >
          {value}
          {unit ? (
            <AppText
              className={cn('font-gilroy-semibold text-[18px] tracking-normal', hero && 'text-white dark:text-white')}
            >{` ${unit}`}</AppText>
          ) : null}
        </AppText>
        <View
          className={cn(
            'h-10 w-10 items-center justify-center rounded-[10px]',
            hero ? 'bg-white/10' : 'bg-black/[0.04] dark:bg-white/10',
          )}
        >
          <Icon size={20} color={hero ? colors.white : iconColor} />
        </View>
      </View>
      <AppText
        className={cn(
          'font-gilroy-semibold text-[15px] leading-[20px]',
          unit && 'mt-1',
          hero ? 'text-white/75 dark:text-white/75' : 'text-primary/70 dark:text-dark-text/70',
        )}
      >
        {label}
      </AppText>
      {hint ? <AppText className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">{hint}</AppText> : null}
    </View>
  );
}

function StatCardSkeleton({ hero }: { hero?: boolean }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2 rounded-[14px] border bg-white px-5 py-[18px] dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between">
        <Skeleton className={cn('h-10', hero ? 'w-2/3' : 'w-1/3')} />
        <Skeleton className="h-10 w-10 rounded-[10px]" />
      </View>
      <Skeleton className="h-4 w-28" />
    </View>
  );
}

function CurrentEventRow({ eventId }: { eventId: number }) {
  const { t } = useTranslation();
  const { data: list } = useGetOrganizerEventsQuery();
  const { data: detail } = useSelectedEvent();
  const chevronColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const listItem = list?.events.find((event) => event.id === eventId);
  const name = listItem?.name ?? detail?.title;
  if (!name) return null;
  const status = listItem ? organizerEventStatus(listItem, t) : null;
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        navigate.dismissTo('dashboard');
      }}
      accessibilityLabel={`${t('Current event')}: ${name}`}
      className="flex-row items-center gap-2.5 px-1 pb-3"
    >
      <BlurredPoster
        uri={listItem?.image ?? detail?.images[0] ?? null}
        className="h-9 w-9 rounded-[8px]"
        iconSize={16}
        recyclingKey={String(eventId)}
      />
      <View className="flex-1">
        <AppText className="font-gilroy-semibold text-[11px] uppercase leading-[14px] tracking-wide text-muted dark:text-dark-muted">
          {t('Current event')}
        </AppText>
        <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
          {name}
        </AppText>
      </View>
      {status ? (
        <View className="h-[22px] justify-center rounded-full px-2.5" style={{ backgroundColor: status.color }}>
          <AppText className="font-gilroy-bold text-[10px] uppercase tracking-wide text-white dark:text-white">
            {status.label}
          </AppText>
        </View>
      ) : null}
      <ChevronRight size={18} color={chevronColor} />
    </PressableScale>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const { eventId } = useSelectedEvent();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const chipIconColor = useThemeColor(colors.primary, colors.dark.text);
  const buttonIconColor = useThemeColor(colors.white, colors.primary);

  const { data: stats, isLoading, isError, refetch } = useGetOrganizerStatsQuery(undefined, { skip: !user });
  const { data: fetchedRates, refetch: refetchRates } = useGetExchangeRatesQuery(undefined, { skip: !user });
  const [period, setPeriod] = useState<IntervalKey>('all_time');
  const [sheet, setSheet] = useState<'period' | 'currency' | null>(null);
  const [storedCurrency, setStoredCurrency] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void cache.get<string>(STORAGE_KEYS.defaultCurrency).then(setStoredCurrency);
  }, []);

  const eventCurrencies = useMemo(() => stats?.event_currencies ?? [], [stats?.event_currencies]);
  const isMixed = eventCurrencies.length > 1;
  const currency = isMixed ? (storedCurrency ?? eventCurrencies[0]) : (eventCurrencies[0] ?? storedCurrency ?? 'MDL');
  const rates = useMemo(
    () => ({
      rates: { ...FALLBACK_RATES.rates, ...fetchedRates?.rates },
      nominals: { ...FALLBACK_RATES.nominals, ...fetchedRates?.nominals },
    }),
    [fetchedRates],
  );

  const chooseCurrency = useCallback((code: string) => {
    setStoredCurrency(code);
    void cache.set(STORAGE_KEYS.defaultCurrency, code);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchRates()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchRates]);

  if (isBootstrapping) return <Screen>{null}</Screen>;
  if (!isAuthenticated) return <Redirect href={href(routes.login)} />;

  const firstName = user?.first_name?.trim() || user?.organization_name?.trim() || '';
  const bucket = stats?.[period];
  const allTime = stats?.all_time;
  const money = (byCurrency: Record<string, number> | undefined) =>
    groupThousands(isMixed ? sumInCurrency(byCurrency, currency, rates) : (byCurrency?.[currency] ?? 0), 2);
  const totalTickets = allTime?.total_tickets ?? 0;
  const freeTickets = allTime?.manual_tickets_count ?? 0;
  const paidTickets = Math.max(0, totalTickets - freeTickets);
  const periodLabel = t(PERIODS.find((option) => option.value === period)?.label ?? 'All Time');

  return (
    <Screen edges={[]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spinnerColor} colors={[spinnerColor]} />
        }
      >
        <View className="flex-row items-start gap-3 px-4 pb-3.5">
          <View className="flex-1 gap-0.5">
            <AppText className="font-gilroy-bold text-[24px] leading-[28px]">
              {firstName ? t('Welcome, {{name}}', { name: firstName }) : t('Dashboard')}
            </AppText>
            <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
              {t('Here is the information about all your events')}
            </AppText>
          </View>
          <OrganizerSwitcher />
        </View>

        <View className="gap-3 px-4 pt-2">
          <View className="flex-row items-center justify-between gap-2">
            <AppText className="font-gilroy-semibold text-[18px] leading-[24px]">{t('Statistics')}</AppText>
            <View className="flex-row gap-2">
              <Chip
                label={periodLabel}
                onPress={() => setSheet('period')}
                icon={<Clock size={16} color={chipIconColor} />}
                trailing={<ChevronDown size={14} color={chipIconColor} />}
              />
              {isMixed ? (
                <Chip
                  label={currency}
                  onPress={() => setSheet('currency')}
                  icon={<Banknote size={16} color={chipIconColor} />}
                  trailing={<ChevronDown size={14} color={chipIconColor} />}
                />
              ) : null}
            </View>
          </View>

          {isLoading ? (
            <>
              <StatCardSkeleton hero />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : isError ? (
            <EmptyState
              icon={LayoutDashboard}
              title={t('Something went wrong.')}
              message={t('Please try again.')}
              actionLabel={t('Try again')}
              onAction={() => void refetch()}
            />
          ) : (
            <>
              <StatCard
                hero
                icon={BriefcaseBusiness}
                label={t('Total Revenue')}
                value={money(bucket?.income_by_currency)}
                unit={currency}
              />
              <StatCard icon={CircleCheckBig} label={t('Tickets Sold')} value={groupThousands(bucket?.tickets_sold ?? 0)} />
              <StatCard icon={Users} label={t('Total Users')} value={groupThousands(bucket?.new_users ?? 0)} />
              <StatCard
                icon={CreditCard}
                label={
                  <>
                    {t('Paid Tickets')}
                    {totalTickets > 0 ? (
                      <AppText className="font-gilroy-medium text-[15px] text-muted dark:text-dark-muted">
                        {` ${t('({{percent}}% of all tickets)', { percent: ((paidTickets / totalTickets) * 100).toFixed(1) })}`}
                      </AppText>
                    ) : null}
                  </>
                }
                value={groupThousands(paidTickets)}
              />
              <StatCard icon={Gift} label={t('Free Tickets')} value={groupThousands(freeTickets)} />
              <StatCard
                icon={Heart}
                label={t('Total Received')}
                value={money(bucket?.total_received_by_currency)}
                unit={currency}
                hint={t('sum without invoices')}
              />
              <PressableScale
                onPress={() => {
                  haptics.selection();
                  navigate.overview();
                }}
                accessibilityLabel={t('See detailed statistics')}
                className="h-11 flex-row items-center justify-center gap-1.5"
              >
                <AppText className="font-gilroy-semibold text-[15px] leading-[20px]">{t('See detailed statistics')}</AppText>
                <ChevronRight size={16} color={chipIconColor} />
              </PressableScale>
            </>
          )}
        </View>
      </ScrollView>

      <GlassSurface
        className="absolute bottom-0 left-0 right-0 rounded-b-none rounded-t-[24px] border-b-0 px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {eventId != null ? <CurrentEventRow eventId={eventId} /> : null}
        <GlassButton
          label={t('Select an event')}
          variant="primary"
          onPress={navigate.selectEvent}
          icon={<CalendarDays size={18} color={buttonIconColor} />}
        />
      </GlassSurface>

      {sheet === 'period' ? (
        <OptionSheet
          title={t('Statistics')}
          options={PERIODS.map((option) => ({ value: option.value, label: t(option.label) }))}
          value={period}
          onSelect={setPeriod}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'currency' ? (
        <OptionSheet
          title={t('Currency')}
          options={SUMMARY_CURRENCIES.map((option) => ({ value: option.code, label: option.code, hint: t(option.name) }))}
          value={currency}
          onSelect={chooseCurrency}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}
