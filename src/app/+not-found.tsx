import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react-native';

import { AppText, GlassButton, Screen } from '@/components/ui';
import { navigate } from '@/lib/nav';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen className="items-center justify-center gap-4 px-8">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-white/70 dark:bg-white/10">
        <Compass size={28} color="#8a8d93" />
      </View>
      <AppText className="text-center font-gilroy-semibold text-lg">{t('This screen does not exist.')}</AppText>
      <View className="w-48">
        <GlassButton label={t('Go home')} onPress={navigate.home} />
      </View>
    </Screen>
  );
}
