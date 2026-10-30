import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Lock, Ticket } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, PressableScale, Screen } from '@/components/ui';
import {
  ListSkeleton,
  PanelCard,
  PanelError,
  PanelMessage,
  RowDivider,
  SearchField,
  moneyLabel,
} from '@/components/dashboard/dashboardParts';
import { useDebounce } from '@/hooks/useDebounce';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { dateFnsLocale } from '@/lib/format';
import { navigate } from '@/lib/nav';
import { eventPermissions } from '@/lib/sections';
import { useGetEventBuyersQuery, type BuyersTimeInterval, type EventBuyer } from '@/store/api/organizerApi';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';

function buyerName(buyer: EventBuyer, fallback: string): string {
  return buyer.display_name?.trim() || buyer.name?.trim() || buyer.email?.split('@')[0] || fallback;
}

function purchaseDate(value: string | null | undefined, lang: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'd MMM yyyy', { locale: dateFnsLocale(lang) });
}

function PurchaseRow({ buyer, index, currency }: { buyer: EventBuyer; index: number; currency: string }) {
  const { t, i18n } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/20 dark:bg-dark-elevated">
        <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{index + 1}</AppText>
      </View>
      <View className="flex-1">
        <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
          {buyerName(buyer, t('Unknown'))}
        </AppText>
        <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
          {buyer.email || '-'}
        </AppText>
      </View>
      <View className="items-end">
        <AppText className="font-gilroy-bold text-[14px]">{moneyLabel(buyer.total_price, buyer.currency || currency)}</AppText>
        <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{purchaseDate(buyer.date, i18n.language)}</AppText>
      </View>
    </View>
  );
}

export default function TicketInfoScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const user = useAppSelector((state) => state.auth.user);
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 150);
  const [timeInterval, setTimeInterval] = useState<BuyersTimeInterval>('all');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const permissions = eventPermissions(event, user);
  const isCancelled = Boolean(event?.is_cancelled);
  const canQuery = eventId != null && Boolean(event) && permissions.canViewAnalytics && !isCancelled;
  const query = useGetEventBuyersQuery(
    { eventId: eventId ?? 0, page, search, timeInterval },
    { skip: !canQuery, refetchOnMountOrArgChange: true },
  );
  const rows = query.data?.results ?? [];
  const remaining = Math.max(0, (query.data?.total_count ?? 0) - rows.length);
  const fallbackCurrency = rows.find((row) => row.currency)?.currency ?? '';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (canQuery && page > 1) setPage(1);
      await Promise.all([refetchEvent(), ...(canQuery && page === 1 ? [query.refetch()] : [])]);
    } finally {
      setRefreshing(false);
    }
  };

  const intervalOptions: { key: BuyersTimeInterval; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'month', label: t('Monthly') },
    { key: 'week', label: t('Weekly') },
    { key: 'day', label: t('Daily') },
  ];
  const emptyText = searchInput.trim()
    ? t('No results match your search')
    : t('No customers found for the selected time period.');

  const renderList = () => {
    if (isCancelled) return <PanelMessage text={emptyText} />;
    if (query.isError && !query.data) return <PanelError onRetry={() => void query.refetch()} />;
    if (query.isLoading || (query.isFetching && page === 1 && rows.length === 0)) return <ListSkeleton rows={6} />;
    if (rows.length === 0) return <PanelMessage text={emptyText} />;
    return (
      <>
        <PanelCard>
          {rows.map((buyer, index) => (
            <RowDivider key={`${buyer.order_id ?? buyer.id ?? index}-${index}`} index={index}>
              <PurchaseRow buyer={buyer} index={index} currency={fallbackCurrency} />
            </RowDivider>
          ))}
        </PanelCard>
        {query.data?.has_next ? (
          <PressableScale
            onPress={() => setPage((current) => current + 1)}
            disabled={query.isFetching}
            accessibilityLabel={t('Load More')}
            className="h-11 items-center justify-center rounded-[10px] border border-app-border dark:border-dark-border"
          >
            {query.isFetching ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <AppText className="font-gilroy-semibold text-[14px] text-primary dark:text-dark-text">
                {`${t('Load More')} (${remaining} ${t('remaining')})`}
              </AppText>
            )}
          </PressableScale>
        ) : null}
      </>
    );
  };

  const renderBody = () => {
    if (eventError && !event) {
      return (
        <EmptyState
          icon={Ticket}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (eventLoading || !event) return <ListSkeleton rows={6} />;
    if (!permissions.canViewAnalytics) {
      return <EmptyState icon={Lock} title={t("You don't have access to this page.")} />;
    }
    return (
      <>
        <SearchField
          value={searchInput}
          onChange={(next) => {
            setSearchInput(next);
            setPage(1);
          }}
          placeholder={t('Search by name or email...')}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" contentContainerClassName="gap-2">
          {intervalOptions.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              selected={timeInterval === option.key}
              onPress={() => {
                setTimeInterval(option.key);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
        {renderList()}
      </>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Ticket Purchase Info')} onBack={navigate.back} />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: padding.top + 8,
          paddingBottom: padding.bottom,
          paddingHorizontal: 16,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />
        }
      >
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}
