import { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LayoutDashboard, Search } from 'lucide-react-native';

import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { OrganizerEventRow, OrganizerEventRowSkeleton } from '@/components/events/OrganizerEventCard';
import { AppText, DashedAddButton, EmptyState, GlassHeader, GlassInput, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectEvent, useSelectedEventId } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { combineDateTime } from '@/lib/eventStatus';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetOrganizerEventsQuery, type OrganizerEventListItem } from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

const keyExtractor = (item: OrganizerEventListItem) => String(item.id);

function eventStartTime(event: OrganizerEventListItem): number {
  return combineDateTime(event.start_date, event.start_time)?.getTime() ?? 0;
}

const ListHeader = memo(function ListHeader({
  search,
  onSearchChange,
  count,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  count: number | null;
}) {
  const { t } = useTranslation();
  const searchIconColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  return (
    <View className="gap-3 px-4 pb-3 pt-3">
      <GlassInput
        placeholder={t('Search events...')}
        value={search}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        leftIcon={<Search size={18} color={searchIconColor} />}
      />
      <DashedAddButton label={t('Create event')} onPress={navigate.createEvent} />
      {count != null ? (
        <View className="mt-2 flex-row items-center justify-between">
          <AppText className="font-gilroy-semibold text-[18px] leading-[24px]">{t('Your events')}</AppText>
          <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('{{count}} events', { count })}</AppText>
        </View>
      ) : null}
    </View>
  );
});

export default function SelectEventScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding({ tabBar: false });
  const { user } = useAuth();
  const selectedEventId = useSelectedEventId();
  const selectEvent = useSelectEvent();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);

  const { data, isLoading, isError, refetch } = useGetOrganizerEventsQuery(undefined, { skip: !user });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const events = useMemo(() => {
    const list = [...(data?.events ?? [])].sort((a, b) => eventStartTime(b) - eventStartTime(a));
    const query = search.trim().toLowerCase();
    return query ? list.filter((event) => event.name.toLowerCase().includes(query)) : list;
  }, [data, search]);

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [user, refetch]);

  const onSelect = useCallback(
    async (eventId: number) => {
      haptics.selection();
      await selectEvent(eventId);
      navigate.dismissTo('dashboard');
    },
    [selectEvent],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: OrganizerEventListItem; index: number }) => (
      <OrganizerEventRow
        event={item}
        selected={item.id === selectedEventId}
        first={index === 0}
        last={index === events.length - 1}
        onPress={() => onSelect(item.id)}
      />
    ),
    [onSelect, selectedEventId, events.length],
  );

  const empty = isLoading ? (
    <View>
      {[0, 1, 2, 3].map((row) => (
        <OrganizerEventRowSkeleton key={row} first={row === 0} last={row === 3} />
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
  ) : search.trim() ? (
    <EmptyState icon={Search} title={t('No events match your search.')} />
  ) : (
    <EmptyState
      icon={CalendarDays}
      title={t("You haven't created any events yet.")}
      actionLabel={t('Create event')}
      onAction={navigate.createEvent}
    />
  );

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Select an event')}
        onBack={() => navigate.dismissTo('home')}
        right={<OrganizerSwitcher />}
      />
      <FlashList
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={`${selectedEventId}:${events.length}`}
        ListHeaderComponent={
          isLoading || data?.events.length ? (
            <ListHeader search={search} onSearchChange={setSearch} count={events.length ? events.length : null} />
          ) : null
        }
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spinnerColor} colors={[spinnerColor]} />
        }
      />
    </Screen>
  );
}
