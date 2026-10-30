import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useGetOrgTrafficStatsQuery } from '@/store/api/trafficApi';
import { TrafficStatsSection } from '@/components/traffic/TrafficStatsSection';
import { AppText, GlassHeader, Screen } from '@/components/ui';

export default function ProfileTrafficScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const stats = useGetOrgTrafficStatsQuery({});

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Profile Traffic')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={stats.isFetching && !stats.isLoading}
            onRefresh={() => void stats.refetch()}
            tintColor={colors.muted}
          />
        }
      >
        <View className="gap-3">
          <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
            {t('Monitor where your profile visitors are coming from')}
          </AppText>
          <TrafficStatsSection
            aggregate
            data={stats.data}
            isLoading={stats.isLoading}
            isError={stats.isError}
            onRetry={() => void stats.refetch()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
