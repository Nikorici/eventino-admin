import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Construction, type LucideIcon } from 'lucide-react-native';

import { EmptyState, GlassHeader, Screen } from '@/components/ui';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { navigate } from '@/lib/nav';

export function StubScreen({
  title,
  icon = Construction,
  tabBar = true,
}: {
  title: string;
  icon?: LucideIcon;
  tabBar?: boolean;
}) {
  const { t } = useTranslation();
  const padding = useScreenPadding({ tabBar });
  return (
    <Screen edges={[]}>
      <GlassHeader title={t(title)} onBack={navigate.back} />
      <View className="flex-1 justify-center" style={{ paddingTop: padding.top, paddingBottom: padding.bottom }}>
        <EmptyState icon={icon} title={t('Coming soon')} />
      </View>
    </Screen>
  );
}
