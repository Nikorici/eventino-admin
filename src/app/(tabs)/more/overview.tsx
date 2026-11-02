import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LayoutDashboard } from 'lucide-react-native';

import { SearchField, SectionTitle } from '@/components/dashboard/dashboardParts';
import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { OverviewEventCard, OverviewEventCardSkeleton } from '@/components/overview/OverviewEventCard';
import { OverviewStatistics } from '@/components/overview/OverviewStatistics';
import { useSummaryCurrency } from '@/components/overview/useSummaryCurrency';
import { WelcomeHeading } from '@/components/overview/WelcomeHeading';
import { EmptyState, GlassHeader, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { combineDateTime } from '@/lib/eventStatus';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useGetOrganizerEventsQuery,
  useGetOrganizerGraphQuery,
  useGetOrganizerStatsQuery,
  type OrganizerEventListItem,
} from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

const keyExtractor = (item: OrganizerEventListItem) => String(item.id);

const ItemSeparator = () => <View className="h-4" />;

function eventStartTime(event: OrganizerEventListItem): number {
  return combineDateTime(event.start_date, event.start_time)?.getTime() ?? 0;
}

export default function OverviewScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { user } = useAuth();
  const selectEvent = useSelectEvent();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);

  const stats = useGetOrganizerStatsQuery(undefined, { skip: !user });
  const graph = useGetOrganizerGraphQuery({ interval: 'day' }, { skip: !user });
  const eventsQuery = useGetOrganizerEventsQuery(undefined, { skip: !user });
  const eventCurrencies = useMemo(() => stats.data?.event_currencies ?? [], [stats.data?.event_currencies]);
  const summary = useSummaryCurrency(eventCurrencies, !user);

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const events = useMemo(() => {
    const list = [...(eventsQuery.data?.events ?? [])].sort((a, b) => eventStartTime(b) - eventStartTime(a));
    const query = search.trim().toLowerCase();
    return query ? list.filter((event) => event.name.toLowerCase().includes(query)) : list;
  }, [eventsQuery.data, search]);

  const { refetch: refetchStats } = stats;
  const { refetch: refetchGraph } = graph;
  const { refetch: refetchEvents } = eventsQuery;
  const { refetchRates } = summary;

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchGraph(), refetchEvents(), refetchRates()]);
    } finally {
      setRefreshing(false);
    }
  }, [user, refetchStats, refetchGraph, refetchEvents, refetchRates]);

  const openEvent = useCallback(
    async (eventId: number) => {
      haptics.selection();
      await selectEvent(eventId);
      navigate.dashboard();
    },
    [selectEvent],
  );

  const renderItem = useCallback(
    ({ item }: { item: OrganizerEventListItem }) => (
      <View className="px-4">
        <OverviewEventCard event={item} onPress={() => void openEvent(item.id)} />
      </View>
    ),
    [openEvent],
  );

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Overview')} onBack={navigate.back} right={<OrganizerSwitcher />} />
      <FlashList
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View className="gap-4 px-4 pb-4">
            <WelcomeHeading />
            <OverviewStatistics
              stats={stats.data}
              isLoading={stats.isLoading}
              isError={stats.isError}
              onRetry={() => void refetchStats()}
              summary={summary}
            />
            <View className="mt-1 gap-4">
              <SectionTitle>{t('List of Events')}</SectionTitle>
              <SearchField value={search} onChange={setSearch} placeholder={t('Search events...')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          eventsQuery.isLoading ? (
            <View className="gap-4 px-4">
              <OverviewEventCardSkeleton />
              <OverviewEventCardSkeleton />
            </View>
          ) : eventsQuery.isError ? (
            <EmptyState
              icon={LayoutDashboard}
              title={t('Something went wrong.')}
              message={t('Please try again.')}
              actionLabel={t('Try again')}
              onAction={() => void refetchEvents()}
            />
          ) : (
            <EmptyState icon={CalendarDays} title={t('No data found.')} />
          )
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: padding.top + 8, paddingBottom: padding.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      />
    </Screen>
  );
}
