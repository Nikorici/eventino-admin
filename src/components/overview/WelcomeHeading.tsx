import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/cn';

export function WelcomeHeading({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const firstName = user?.first_name?.trim() || user?.organization_name?.trim() || '';
  return (
    <View className={cn('gap-0.5', className)}>
      <AppText className="font-gilroy-bold text-[24px] leading-[28px]">
        {firstName ? t('Welcome, {{name}}', { name: firstName }) : t('Dashboard')}
      </AppText>
      <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
        {t('Here is the information about all your events')}
      </AppText>
    </View>
  );
}
