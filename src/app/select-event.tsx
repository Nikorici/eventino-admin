import { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LayoutDashboard, Plus, Search } from 'lucide-react-native';

import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { OrganizerEventCard, OrganizerEventCardSkeleton } from '@/components/events/OrganizerEventCard';
import { AppText, EmptyState, GlassButton, GlassHeader, GlassInput, Screen } from '@/components/ui';
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

const ItemSeparator = () => <View className="h-4" />;

function eventStartTime(event: OrganizerEventListItem): number {
  return combineDateTime(event.start_date, event.start_time)?.getTime() ?? 0;
}

const ListHeader = memo(function ListHeader({
  firstName,
  search,
  onSearchChange,
}: {
  firstName: string;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const plusColor = useThemeColor(colors.white, colors.primary);
  const searchIconColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  return (
    <View className="gap-4 px-4 pb-4">
      <View className="gap-0.5">
        <AppText className="font-gilroy-bold text-[24px] leading-[28px]">
          {firstName ? t('Welcome, {{name}}', { name: firstName }) : t('Dashboard')}
        </AppText>
        <AppText className="font-gilroy-medium text-[14px] text-muted">
          {t('Here is the information about all your events')}
        </AppText>
      </View>
      <GlassButton
        label={t('Create event')}
        variant="primary"
        onPress={navigate.createEvent}
        icon={<Plus size={18} color={plusColor} />}
      />
      <AppText className="mt-1 font-gilroy-semibold text-[18px]">{t('Your events')}</AppText>
      <GlassInput
        placeholder={t('Search events...')}
        value={search}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        leftIcon={<Search size={18} color={searchIconColor} />}
      />
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
  const firstName = user?.first_name?.trim() || user?.organization_name?.trim() || '';

  const { data, isLoading, isError, refetch } = useGetOrganizerEventsQuery(undefined, { skip: !user });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const events = useMemo(() => {
    const list = [...(data?.events ?? [])].sort((a, b) => eventStartTime(b) - eventStartTime(a));
    const query = search.trim().toLowerCase();
    return query ? list.filter((event) => event.name.toLowerCase().includes(query)) : list;
  }, [data, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const onSelect = useCallback(
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
        <OrganizerEventCard event={item} selected={item.id === selectedEventId} onPress={() => onSelect(item.id)} />
      </View>
    ),
    [onSelect, selectedEventId],
  );

  const empty = isLoading ? (
    <View className="gap-4 px-4">
      <OrganizerEventCardSkeleton />
      <OrganizerEventCardSkeleton />
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
        onBack={router.canGoBack() ? navigate.back : undefined}
        right={<OrganizerSwitcher />}
      />
      <FlashList
        data={events}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={selectedEventId}
        ListHeaderComponent={<ListHeader firstName={firstName} search={search} onSearchChange={setSearch} />}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={ItemSeparator}
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
