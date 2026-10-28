import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { cn } from '@/lib/cn';
import { priceInfo } from '@/lib/format';
import type { EventDetail, EventListItem } from '@/types/api';
import { AppText } from '@/components/ui/AppText';

export interface PriceBadgeProps {
  event: EventListItem | EventDetail;
  className?: string;
}

export function PriceBadge({ event, className }: PriceBadgeProps) {
  const { t } = useTranslation();
  const info = priceInfo(event, t('Free'), t('Sold out'));

  return (
    <View
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
      className={cn(
        'self-start rounded-[6px] border px-2.5 py-1',
        info.isSoldOut ? 'border-white/10 bg-primary' : 'border-black/5 bg-white',
        className,
      )}
    >
      <AppText
        className={cn(
          'font-gilroy-bold text-[13px]',
          info.isSoldOut ? 'text-white dark:text-white' : 'text-primary dark:text-primary',
        )}
      >
        {info.isFree ? t('Free') : info.label}
      </AppText>
    </View>
  );
}
