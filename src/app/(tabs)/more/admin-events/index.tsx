import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Switch, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  FolderDown,
  Landmark,
  LayoutDashboard,
  MapPin,
  Search,
  ShieldAlert,
  TicketPercent,
  Users,
  X,
} from 'lucide-react-native';

import { ACCENT_GREEN, ACCENT_ORANGE, ROW_DIVIDER } from '@/components/dashboard/dashboardParts';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { OptionSheet, type SheetOption } from '@/components/dashboard/OptionSheet';
import { EventFormDateTimeField } from '@/components/events/EventFormDateTimeField';
import {
  AppText,
  Chip,
  EmptyState,
  GlassHeader,
  GlassInput,
  PressableScale,
  Screen,
  SegmentedControl,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { todayISODate } from '@/lib/checkin';
import { accountingEndpoint, WEB_ORIGIN } from '@/lib/constants';
import { downloadAuthedFile, shareFile } from '@/lib/downloads';
import { getEventTimeStatus } from '@/lib/eventStatus';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { formatMoney } from '@/lib/pricing';
import { getAccessToken } from '@/lib/storage';
import {
  useGetStaffEventsQuery,
  useSetEventPaymentStatusMutation,
  type AdminEventsCountry,
  type StaffEvent,
  type StaffPaymentFilter,
} from '@/store/api/adminApi';
import { colors, currencySymbol } from '@/theme/colors';

const PAGE_SIZE = 25;
const ALL = 'all';

type FilterSheet = 'country' | 'region' | 'payment';

const PAYMENT_OPTIONS: { value: StaffPaymentFilter; label: string }[] = [
  { value: 'all', label: 'All payments' },
  { value: 'done', label: 'Payment done' },
  { value: 'pending', label: 'Payment pending' },
];

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#8e8e93' },
  live: { label: 'On Delivery', color: '#ff9500' },
  today: { label: 'Today', color: '#007aff' },
  finished: { label: 'Finished', color: '#ff0000' },
  active: { label: 'Active', color: '#34c759' },
};

const keyExtractor = (item: StaffEvent) => String(item.id);

const ItemSeparator = () => <View className="h-3" />;

function eventStatusKey(event: StaffEvent): string {
  if (event.in_draft) return 'draft';
  const status = getEventTimeStatus(event);
  return status === 'live' || status === 'today' || status === 'finished' ? status : 'active';
}

function formatStaffDate(iso: string | null, lang: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'd MMM yyyy', { locale: dateFnsLocale(lang) });
}

function formatStaffRange(start: string | null, end: string | null, lang: string): string {
  const startText = formatStaffDate(start, lang);
  const endText = formatStaffDate(end, lang);
  if (startText && endText && endText !== startText) return `${startText} — ${endText}`;
  return startText;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayISODate(date);
}

function AdminEventCard({
  event,
  paid,
  toggling,
  onOpen,
  onTogglePaid,
}: {
  event: StaffEvent;
  paid: boolean;
  toggling: boolean;
  onOpen: () => void;
  onTogglePaid: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor(ROW_DIVIDER, colors.dark.border);
  const switchTrackOff = useThemeColor('#e9e9ea', colors.dark.elevated);
  const location = [event.region, event.country].filter(Boolean).join(', ');
  const dateText = formatStaffRange(event.start_date, event.end_date, i18n.language);
  const status = STATUS_STYLES[eventStatusKey(event)];
  const symbol = currencySymbol(event.currency) || 'RON';

  const openOwner = () => {
    if (event.owner_id == null) return;
    haptics.selection();
    void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/profile/${event.owner_slug}/${event.owner_id}`);
  };

  return (
    <View className="rounded-[12px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <PressableScale onPress={onOpen} accessibilityLabel={event.name} className="w-full gap-2 rounded-[12px] px-4 pb-2 pt-3.5">
        <View className="flex-row items-start gap-2">
          <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[16px] leading-[21px]">
            {event.name}
          </AppText>
          <View
            className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
            style={{ backgroundColor: paid ? `${ACCENT_GREEN}22` : `${ACCENT_ORANGE}22` }}
          >
            {paid ? <CircleCheck size={12} color={ACCENT_GREEN} /> : <Clock size={12} color={ACCENT_ORANGE} />}
            <AppText
              className="font-gilroy-bold text-[10px] uppercase tracking-wide"
              style={{ color: paid ? ACCENT_GREEN : ACCENT_ORANGE }}
            >
              {paid ? t('Paid') : t('Pending')}
            </AppText>
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <View className="shrink flex-row items-center gap-1.5">
            <Users size={13} color={colors.muted} />
            <AppText
              numberOfLines={1}
              onPress={openOwner}
              accessibilityRole="link"
              suppressHighlighting
              className="shrink font-gilroy-medium text-[13px] text-links underline dark:text-dark-text"
            >
              {event.owner_name || t('Unknown')}
            </AppText>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
            <AppText className="font-gilroy-semibold text-[12px] text-primary/80 dark:text-dark-text/80">
              {t(status.label)}
            </AppText>
          </View>
        </View>

        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
          <AppText className="font-gilroy-semibold text-[12px] text-primary/70 dark:text-dark-text/70">#{event.id}</AppText>
          {location ? (
            <View className="flex-row items-center gap-1.5">
              <MapPin size={13} color={colors.muted} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-primary/70 dark:text-dark-text/70">
                {location}
              </AppText>
            </View>
          ) : null}
          {dateText ? (
            <View className="flex-row items-center gap-1.5">
              <CalendarDays size={13} color={colors.muted} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-primary/70 dark:text-dark-text/70">
                {dateText}
              </AppText>
            </View>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-end justify-between gap-3 border-t pt-3" style={{ borderColor: rowDivider }}>
          <View className="flex-1">
            <AppText className="font-gilroy-medium text-[10px] uppercase tracking-wide text-muted dark:text-dark-muted">{t('Coupons')}</AppText>
            {event.coupons.length > 0 ? (
              <View className="mt-1 flex-row flex-wrap gap-1.5">
                {event.coupons.map((coupon) => (
                  <View
                    key={coupon.code}
                    className="h-6 flex-row items-center gap-1 rounded-[6px] bg-black/[0.04] px-2 dark:bg-white/10"
                  >
                    <TicketPercent size={12} color={colors.muted} />
                    <AppText className="font-gilroy-semibold text-[12px] text-primary/80 dark:text-dark-text/80">
                      {`${coupon.code} (${coupon.discount})`}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText className="mt-1 font-gilroy-semibold text-[13px] text-primary/80 dark:text-dark-text/80">
                {t('No coupons')}
              </AppText>
            )}
          </View>
          <View className="shrink-0 items-end">
            <AppText className="font-gilroy-medium text-[10px] uppercase tracking-wide text-muted dark:text-dark-muted">{t('Total Income')}</AppText>
            <AppText className="font-gilroy-bold text-[15px]" style={{ color: ACCENT_GREEN }}>
              {symbol} {formatMoney(Number(event.income) || 0)}
            </AppText>
          </View>
        </View>
      </PressableScale>

      <View className="gap-2 px-4 pb-3.5">
        <View className="flex-row items-center justify-between py-1">
          <AppText className="font-gilroy-semibold text-[14px]">{t('Payment done')}</AppText>
          <Switch
            value={paid}
            disabled={toggling}
            accessibilityLabel={t('Payment done')}
            onValueChange={() => {
              haptics.selection();
              onTogglePaid();
            }}
            trackColor={{ true: ACCENT_GREEN, false: switchTrackOff }}
            thumbColor={colors.white}
          />
        </View>

        <PressableScale
          onPress={() => {
            haptics.selection();
            navigate.adminAccounting(event.id);
          }}
          accessibilityLabel={t('Accounting')}
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-elevated"
        >
          <Landmark size={15} color={colors.muted} />
          <AppText className="font-gilroy-semibold text-[13px]">{t('Accounting')}</AppText>
        </PressableScale>
      </View>
    </View>
  );
}

function DecontArchiveCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const buttonTint = useThemeColor(colors.white, colors.primary);
  const [dateFrom, setDateFrom] = useState(() => isoDaysAgo(365));
  const [dateTo, setDateTo] = useState(() => isoDaysAgo(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    if (!dateFrom || !dateTo || loading) return;
    haptics.light();
    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        toast(t('You must be logged in for this action.'), 'error');
        return;
      }
      const uri = await downloadAuthedFile(
        accountingEndpoint.romaniaSettlementsArchive(dateFrom, dateTo),
        token,
        `deconturi_romania_${dateFrom}_${dateTo}.zip`,
      );
      const shared = await shareFile(uri, {
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
        dialogTitle: t('Decont archive'),
      });
      if (!shared) await WebBrowser.openBrowserAsync(uri);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : '';
      setError(
        /404|not found/i.test(message)
          ? t('No Romania events with paid tickets in this range.')
          : message || t('Failed to download archive. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View>
        <AppText className="font-gilroy-bold text-[16px]">{t('Decont archive')}</AppText>
        <AppText className="mt-0.5 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
          {t('Download all Romania event decont PDFs grouped by month.')}
        </AppText>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('From')}</AppText>
          <EventFormDateTimeField
            value={dateFrom}
            mode="date"
            placeholder={t('From')}
            icon={<CalendarDays size={14} color={colors.muted} />}
            onChange={setDateFrom}
          />
        </View>
        <View className="flex-1 gap-1.5">
          <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('To')}</AppText>
          <EventFormDateTimeField
            value={dateTo}
            mode="date"
            placeholder={t('To')}
            icon={<CalendarDays size={14} color={colors.muted} />}
            onChange={setDateTo}
          />
        </View>
      </View>
      <PressableScale
        onPress={() => void download()}
        disabled={loading || !dateFrom || !dateTo}
        accessibilityLabel={t('Download archive')}
        className="h-11 flex-row items-center justify-center gap-2 rounded-[10px] bg-primary dark:bg-white"
      >
        {loading ? <ActivityIndicator color={buttonTint} /> : <FolderDown size={16} color={buttonTint} />}
        <AppText className="font-gilroy-semibold text-[14px] text-white dark:text-primary">
          {loading ? t('Generating archive…') : t('Download archive')}
        </AppText>
      </PressableScale>
      {error ? <AppText className="font-gilroy-medium text-[12px] text-danger dark:text-danger">{error}</AppText> : null}
    </View>
  );
}

function EventCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor(ROW_DIVIDER, colors.dark.border);
  return (
    <View className="rounded-[12px] border bg-white px-4 py-3.5 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </View>
      <Skeleton className="mt-2.5 h-3 w-1/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <View className="mt-3 flex-row items-center justify-between border-t pt-3" style={{ borderColor: rowDivider }}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </View>
      <Skeleton className="mt-3 h-10 w-full rounded-[10px]" />
    </View>
  );
}

interface AdminListHeaderProps {
  country: AdminEventsCountry;
  onCountryChange: (country: AdminEventsCountry) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  countryLabel: string;
  regionLabel: string;
  paymentLabel: string;
  onOpenSheet: (sheet: FilterSheet) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  total: number | null;
}

const AdminListHeader = memo(function AdminListHeader({
  country,
  onCountryChange,
  searchValue,
  onSearchChange,
  countryLabel,
  regionLabel,
  paymentLabel,
  onOpenSheet,
  hasActiveFilters,
  onClearFilters,
  total,
}: AdminListHeaderProps) {
  const { t } = useTranslation();
  const iconColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const chipIconColor = useThemeColor(colors.primary, colors.dark.text);

  return (
    <View className="gap-4 pb-3">
      <View className="gap-0.5">
        <AppText className="font-gilroy-bold text-[24px] leading-[28px]">{t('Admin Events')}</AppText>
        <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">
          {t('All platform events across Romania and Moldova.')}
        </AppText>
      </View>

      <SegmentedControl
        options={[
          { value: 'ro', label: t('Romania') },
          { value: 'md', label: t('Moldova') },
        ]}
        value={country}
        onChange={onCountryChange}
      />

      <GlassInput
        placeholder={t('Search by event, owner or ID…')}
        value={searchValue}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        leftIcon={<Search size={18} color={iconColor} />}
      />

      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={countryLabel}
          onPress={() => onOpenSheet('country')}
          trailing={<ChevronDown size={14} color={chipIconColor} />}
          className="px-3"
        />
        <Chip
          label={regionLabel}
          onPress={() => onOpenSheet('region')}
          trailing={<ChevronDown size={14} color={chipIconColor} />}
          className="px-3"
        />
        <Chip
          label={paymentLabel}
          onPress={() => onOpenSheet('payment')}
          trailing={<ChevronDown size={14} color={chipIconColor} />}
          className="px-3"
        />
        {hasActiveFilters ? (
          <Chip
            label={t('Clear filters')}
            onPress={onClearFilters}
            icon={<X size={14} color={chipIconColor} />}
            className="px-3"
          />
        ) : null}
      </View>

      {country === 'ro' ? <DecontArchiveCard /> : null}

      {total != null ? (
        <AppText className="font-gilroy-semibold text-[13px] uppercase tracking-wide text-muted dark:text-dark-muted">
          {`${total} ${total === 1 ? t('Event') : t('Events')}`}
        </AppText>
      ) : null}
    </View>
  );
});

const AdminListEmpty = memo(function AdminListEmpty({
  loading,
  error,
  filtered,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  filtered: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View className="gap-3 pt-1">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title={t('Something went wrong.')}
        message={t('Please try again.')}
        actionLabel={t('Try again')}
        onAction={onRetry}
      />
    );
  }
  if (filtered) return <EmptyState icon={Search} title={t('No events match your filters.')} />;
  return <EmptyState icon={CalendarDays} title={t('No data found.')} />;
});

export default function AdminEventsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const { isAuthenticated, user } = useAuth();
  const selectEvent = useSelectEvent();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const isStaff = user?.is_staff === true;

  const [country, setCountry] = useState<AdminEventsCountry>('ro');
  const [searchInput, setSearchInput] = useState('');
  const [countryFilter, setCountryFilter] = useState(ALL);
  const [regionFilter, setRegionFilter] = useState(ALL);
  const [paymentFilter, setPaymentFilter] = useState<StaffPaymentFilter>('all');
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState<FilterSheet | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<Record<number, boolean>>({});
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const search = useDebounce(searchInput.trim(), 400);

  const [setEventPaymentStatus] = useSetEventPaymentStatusMutation();

  const { data, isLoading, isFetching, isError, refetch } = useGetStaffEventsQuery(
    { country, page, pageSize: PAGE_SIZE, search, countryFilter, region: regionFilter, payment: paymentFilter },
    { skip: !isAuthenticated || !isStaff },
  );

  const events = data?.events ?? [];
  const total = data?.total ?? null;
  const canLoadMore = data ? page < data.pages : false;
  const refreshing = isFetching && page === 1 && !isLoading;
  const loadingMore = isFetching && page > 1;
  const hasActiveFilters = searchInput.trim() !== '' || countryFilter !== ALL || regionFilter !== ALL || paymentFilter !== 'all';

  const countryOptions =
    data?.filters?.countries && data.filters.countries.length > 0
      ? data.filters.countries
      : [...new Set(events.map((event) => event.country).filter((value): value is string => Boolean(value)))].sort();
  const regionOptions =
    data?.filters?.regions && data.filters.regions.length > 0
      ? data.filters.regions
      : [...new Set(events.map((event) => event.region).filter((value): value is string => Boolean(value)))].sort();

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setCountryFilter(ALL);
    setRegionFilter(ALL);
    setPaymentFilter('all');
    setPage(1);
  }, []);

  const onCountryChange = useCallback(
    (next: AdminEventsCountry) => {
      setCountry(next);
      resetFilters();
    },
    [resetFilters],
  );

  const onSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const onEndReached = useCallback(() => {
    if (!isFetching && canLoadMore) setPage((current) => current + 1);
  }, [isFetching, canLoadMore]);

  const onRefresh = useCallback(() => {
    if (page === 1) {
      void refetch();
    } else {
      setPage(1);
    }
  }, [page, refetch]);

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openEvent = useCallback(
    async (eventId: number) => {
      haptics.selection();
      await selectEvent(eventId);
      navigate.dashboard();
    },
    [selectEvent],
  );

  const togglePaid = useCallback(
    async (event: StaffEvent) => {
      const currentValue = paymentStatus[event.id] ?? event.payment_done;
      const nextValue = !currentValue;
      setPaymentStatus((prev) => ({ ...prev, [event.id]: nextValue }));
      setTogglingId(event.id);
      try {
        const response = await setEventPaymentStatus({ eventId: event.id, paymentDone: nextValue }).unwrap();
        setPaymentStatus((prev) => ({ ...prev, [event.id]: Boolean(response.payment_done) }));
      } catch {
        setPaymentStatus((prev) => ({ ...prev, [event.id]: currentValue }));
        toast(t('Update failed'), 'error');
      } finally {
        setTogglingId(null);
      }
    },
    [paymentStatus, setEventPaymentStatus, toast, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: StaffEvent }) => (
      <AdminEventCard
        event={item}
        paid={paymentStatus[item.id] ?? item.payment_done}
        toggling={togglingId === item.id}
        onOpen={() => void openEvent(item.id)}
        onTogglePaid={() => void togglePaid(item)}
      />
    ),
    [paymentStatus, togglingId, openEvent, togglePaid],
  );

  const sheetOptions: SheetOption<string>[] =
    sheet === 'country'
      ? [{ value: ALL, label: t('All countries') }, ...countryOptions.map((value) => ({ value, label: value }))]
      : sheet === 'region'
        ? [{ value: ALL, label: t('All regions') }, ...regionOptions.map((value) => ({ value, label: value }))]
        : PAYMENT_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }));

  const sheetValue = sheet === 'country' ? countryFilter : sheet === 'region' ? regionFilter : paymentFilter;

  const onSheetSelect = (value: string) => {
    if (sheet === 'country') setCountryFilter(value);
    if (sheet === 'region') setRegionFilter(value);
    if (sheet === 'payment') {
      const option = PAYMENT_OPTIONS.find((candidate) => candidate.value === value);
      if (option) setPaymentFilter(option.value);
    }
    setPage(1);
  };

  const paymentLabel = t(PAYMENT_OPTIONS.find((option) => option.value === paymentFilter)?.label ?? 'All payments');

  if (!isAuthenticated || !isStaff) {
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Admin Events')} onBack={navigate.back} />
        <View style={{ paddingTop: padding.top }} className="flex-1 items-center justify-center">
          <EmptyState
            icon={ShieldAlert}
            title={!isAuthenticated ? t('You must be logged in for this action.') : t('Not available')}
            message={isAuthenticated ? t('This section is only available to platform staff.') : undefined}
            actionLabel={!isAuthenticated ? t('Log In') : undefined}
            onAction={!isAuthenticated ? navigate.login : undefined}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Admin Events')} onBack={navigate.back} />
      <FlashList
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={paymentStatus}
        ListHeaderComponent={
          <AdminListHeader
            country={country}
            onCountryChange={onCountryChange}
            searchValue={searchInput}
            onSearchChange={onSearchChange}
            countryLabel={countryFilter === ALL ? t('All countries') : countryFilter}
            regionLabel={regionFilter === ALL ? t('All regions') : regionFilter}
            paymentLabel={paymentLabel}
            onOpenSheet={setSheet}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={resetFilters}
            total={total}
          />
        }
        ListEmptyComponent={
          <AdminListEmpty loading={isLoading} error={isError} filtered={hasActiveFilters} onRetry={onRetry} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator color={spinnerColor} />
            </View>
          ) : null
        }
        ItemSeparatorComponent={ItemSeparator}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      />

      {sheet ? (
        <OptionSheet
          title={sheet === 'country' ? t('Country') : sheet === 'region' ? t('Region') : t('Payment')}
          options={sheetOptions}
          value={sheetValue}
          onSelect={onSheetSelect}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}
