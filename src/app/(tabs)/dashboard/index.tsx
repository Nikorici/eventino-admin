import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react-native';

import { EmptyState, GlassHeader, Screen } from '@/components/ui';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { navigate } from '@/lib/nav';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { data: event, isError, refetch } = useSelectedEvent();

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={event?.title ?? t('Dashboard')}
        onTitlePress={navigate.selectEvent}
        titleAccessibilityLabel={t('Change event')}
      />
      <View className="flex-1 justify-center" style={{ paddingTop: padding.top, paddingBottom: padding.bottom }}>
        {isError ? (
          <EmptyState
            icon={LayoutDashboard}
            title={t('Something went wrong.')}
            message={t('Please try again.')}
            actionLabel={t('Try again')}
            onAction={() => void refetch()}
          />
        ) : (
          <EmptyState icon={LayoutDashboard} title={t('Coming soon')} />
        )}
      </View>
    </Screen>
  );
}
