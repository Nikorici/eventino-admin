import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShieldCheck } from 'lucide-react-native';

import { EmptyState, GlassHeader, Screen, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSections } from '@/hooks/useSections';
import { useThemeColor } from '@/hooks/useThemeColor';
import { navigate } from '@/lib/nav';
import type { TabKey } from '@/lib/sections';
import { colors } from '@/theme/colors';

import { ToolRow, ToolSection } from './ToolRow';

function HubSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2">
      <Skeleton className="h-5 w-1/3" />
      <View className="gap-4 rounded-[14px] border bg-white px-4 py-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} className="flex-row items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-[9px]" />
            <Skeleton className="h-4 flex-1" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SectionHub({ tab, title, header }: { tab: TabKey; title: string; header?: ReactNode }) {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const { groups, isLoading, isError, refetch } = useSections(tab);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Screen edges={[]}>
      <GlassHeader title={title} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16, gap: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={spinnerColor} colors={[spinnerColor]} />
        }
      >
        {header}
        {isLoading ? (
          <HubSkeleton />
        ) : isError ? (
          <EmptyState
            icon={LayoutDashboard}
            title={t('Something went wrong.')}
            message={t('Please try again.')}
            actionLabel={t('Try again')}
            onAction={refetch}
          />
        ) : groups.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("You don't have access to this page.")} />
        ) : (
          groups.map((group) => (
            <ToolSection key={group.key} title={group.title ? t(group.title) : undefined}>
              {group.items.map((item, index) => (
                <ToolRow
                  key={item.key}
                  icon={item.icon}
                  label={t(item.label)}
                  onPress={() => navigate.to(item.route)}
                  last={index === group.items.length - 1}
                />
              ))}
            </ToolSection>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
