import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Gift,
  Heart,
  LayoutDashboard,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { CARD_BORDER, ticketSplit, type IntervalKey } from '@/components/dashboard/DashboardStats';
import { OptionSheet } from '@/components/dashboard/OptionSheet';
import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { CurrencySelector } from '@/components/overview/CurrencySelector';
import { useSummaryCurrency } from '@/components/overview/useSummaryCurrency';
import { WelcomeHeading } from '@/components/overview/WelcomeHeading';
import { EventThumb, organizerEventStatus } from '@/components/events/OrganizerEventCard';
import { AppText, Chip, EmptyState, GlassButton, GlassSurface, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { HEADER_CLEARANCE, useScrollInsets } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { groupThousands } from '@/lib/currency';
import { haptics } from '@/lib/haptics';
import { href, navigate, routes } from '@/lib/nav';
import { useGetOrganizerEventsQuery, useGetOrganizerStatsQuery } from '@/store/api/organizerApi';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';

const PERIODS: { value: IntervalKey; label: string }[] = [
  { value: 'all_time', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
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
        'flex-row items-center gap-3 rounded-[14px] border px-4 py-2.5',
        hero ? 'border-primary bg-primary dark:border-white/[0.12]' : 'bg-white dark:bg-dark-surface',
      )}
      style={hero ? undefined : { borderColor: cardBorder }}
    >
      <View className="flex-1">
        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          className={cn(
            'font-gilroy-bold',
            hero ? 'text-[26px] leading-[32px] tracking-[-0.52px]' : 'text-[24px] leading-[30px] tracking-[-0.48px]',
            hero && 'text-white dark:text-white',
          )}
        >
          {unit ? `${value} ` : value}
          {unit ? (
            <AppText
              className={cn('font-gilroy-semibold text-[15px] leading-[20px] tracking-normal', hero && 'text-white dark:text-white')}
            >
              {unit}
            </AppText>
          ) : null}
        </AppText>
        <AppText
          numberOfLines={1}
          className={cn(
            'font-gilroy-semibold text-[13px] leading-[17px]',
            hero ? 'text-white/75 dark:text-white/75' : 'text-primary/70 dark:text-dark-text/70',
          )}
        >
          {label}
        </AppText>
        {hint ? (
          <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] leading-[14px] text-muted dark:text-dark-muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <View
        className={cn(
          'h-9 w-9 items-center justify-center rounded-[10px]',
          hero ? 'bg-white/[0.12]' : 'bg-black/[0.04] dark:bg-white/10',
        )}
      >
        <Icon size={18} color={hero ? colors.white : iconColor} />
      </View>
    </View>
  );
}

function StatCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className="flex-row items-center gap-3 rounded-[14px] border bg-white px-4 py-2.5 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-3.5 w-24" />
      </View>
      <Skeleton className="h-9 w-9 rounded-[10px]" />
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
      <EventThumb
        uri={listItem?.image ?? detail?.images[0] ?? null}
        className="h-9 w-9 rounded-[8px]"
        recyclingKey={String(eventId)}
      />
      <View className="flex-1">
        <AppText className="font-gilroy-semibold text-[11px] uppercase leading-[14px] tracking-[0.44px] text-muted dark:text-dark-muted">
          {t('Current event')}
        </AppText>
        <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
          {name}
        </AppText>
      </View>
      {status ? (
        <View className="h-[22px] justify-center rounded-full px-2.5" style={{ backgroundColor: status.color }}>
          <AppText className="font-gilroy-bold text-[10px] uppercase tracking-[0.5px] text-white dark:text-white">
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
  const scroll = useScrollInsets({ tabBar: false, topOffset: 8 - HEADER_CLEARANCE });
  const { user, isAuthenticated } = useAuth();
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const { eventId } = useSelectedEvent();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const chipIconColor = useThemeColor(colors.primary, colors.dark.text);
  const buttonIconColor = useThemeColor(colors.white, colors.primary);

  const { data: stats, isLoading, isError, refetch } = useGetOrganizerStatsQuery(undefined, { skip: !user });
  const [period, setPeriod] = useState<IntervalKey>('all_time');
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const eventCurrencies = useMemo(() => stats?.event_currencies ?? [], [stats?.event_currencies]);
  const { currency, isMixed, chooseCurrency, refetchRates, total } = useSummaryCurrency(eventCurrencies, !user);

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

  const bucket = stats?.[period];
  const money = (byCurrency: Record<string, number> | undefined) =>
    groupThousands(total(byCurrency), 2);
  const { total: totalTickets, paid: paidTickets, free: freeTickets } = ticketSplit(bucket);
  const periodLabel = t(PERIODS.find((option) => option.value === period)?.label ?? 'All Time');

  return (
    <Screen edges={[]}>
      <ScrollView
        {...scroll.scrollProps}
        contentContainerStyle={{ paddingTop: scroll.paddingTop, paddingBottom: insets.bottom + 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spinnerColor} colors={[spinnerColor]} progressViewOffset={scroll.refreshOffset} />
        }
      >
        <View className="flex-row items-start gap-3 px-4 pb-3.5">
          <WelcomeHeading className="flex-1" />
          <PressableScale
            onPress={() => {
              haptics.selection();
              navigate.accountSettings();
            }}
            accessibilityLabel={t('Settings')}
            className="h-10 w-10 items-center justify-center"
          >
            <Settings size={22} color={chipIconColor} />
          </PressableScale>
          <OrganizerSwitcher />
        </View>

        <View className="gap-3 px-4 pt-2">
          <View className="flex-row items-center justify-between gap-2">
            <AppText className="font-gilroy-semibold text-[18px] leading-[24px]">{t('Statistics')}</AppText>
            <View className="flex-row gap-2">
              <Chip
                label={periodLabel}
                onPress={() => setPeriodSheetOpen(true)}
                icon={<Clock size={16} color={chipIconColor} />}
                trailing={<ChevronDown size={14} color={chipIconColor} />}
              />
              {isMixed ? <CurrencySelector currency={currency} onSelect={chooseCurrency} /> : null}
            </View>
          </View>

          {isLoading ? (
            <View className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((key) => (
                <StatCardSkeleton key={key} />
              ))}
            </View>
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
              <View className="gap-2">
                <StatCard
                  hero
                  icon={BriefcaseBusiness}
                  label={t('Total Revenue')}
                  value={money(bucket?.income_by_currency)}
                  unit={currency}
                />
                <StatCard icon={Ticket} label={t('Total Tickets')} value={groupThousands(totalTickets)} />
                <StatCard icon={Users} label={t('Total Users')} value={groupThousands(bucket?.new_users ?? 0)} />
                <StatCard
                  icon={CreditCard}
                  label={
                    <>
                      {t('Paid Tickets')}
                      {totalTickets > 0 ? (
                        <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
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
              </View>
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
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {eventId != null ? <CurrentEventRow eventId={eventId} /> : null}
        <GlassButton
          label={t('Select an event')}
          variant="primary"
          onPress={navigate.selectEvent}
          icon={<CalendarDays size={18} color={buttonIconColor} />}
        />
      </GlassSurface>

      {periodSheetOpen ? (
        <OptionSheet
          title={t('Statistics')}
          options={PERIODS.map((option) => ({ value: option.value, label: t(option.label) }))}
          value={period}
          onSelect={setPeriod}
          onClose={() => setPeriodSheetOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
