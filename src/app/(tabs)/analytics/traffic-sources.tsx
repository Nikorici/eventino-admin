import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarX2 } from 'lucide-react-native';

import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useGetEventBuyerLocationsQuery, useGetEventTrafficSourcesQuery } from '@/store/api/trackingApi';
import { TrafficStatsSection } from '@/components/traffic/TrafficStatsSection';
import { BuyerLocationsCard } from '@/components/traffic/BuyerLocationsCard';
import { AppText, EmptyState, GlassHeader, Screen, Skeleton } from '@/components/ui';

export default function TrafficSourcesScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const isCancelled = Boolean(event?.is_cancelled);
  const stats = useGetEventTrafficSourcesQuery(eventId ?? 0, { skip: eventId == null || !event || isCancelled });
  const locations = useGetEventBuyerLocationsQuery(eventId ?? 0, { skip: eventId == null || !event });

  const refreshing = (stats.isFetching && !stats.isLoading) || (locations.isFetching && !locations.isLoading);
  const onRefresh = () => {
    void refetchEvent();
    if (!isCancelled) void stats.refetch();
    void locations.refetch();
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Traffic Sources')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        <View className="gap-3">
          <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
            {t('Monitor where your event visitors are coming from')}
          </AppText>
          {eventLoading ? (
            <View className="gap-3">
              <Skeleton className="h-[72px] w-full rounded-[12px]" />
              <Skeleton className="h-[160px] w-full rounded-[12px]" />
            </View>
          ) : eventError || !event ? (
            <EmptyState
              icon={CalendarX2}
              title={t('Unable to load event data.')}
              actionLabel={t('Try again')}
              onAction={() => void refetchEvent()}
            />
          ) : (
            <>
              {isCancelled ? (
                <EmptyState icon={CalendarX2} title={t('Event cancelled, no traffic sources.')} />
              ) : (
                <TrafficStatsSection
                  data={stats.data}
                  isLoading={stats.isLoading}
                  isError={stats.isError}
                  onRetry={() => void stats.refetch()}
                />
              )}
              <BuyerLocationsCard
                data={locations.data}
                isLoading={locations.isLoading}
                isError={locations.isError}
                onRetry={() => void locations.refetch()}
              />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
