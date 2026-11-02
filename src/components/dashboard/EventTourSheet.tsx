import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, Info, ListChecks, X, type LucideIcon } from 'lucide-react-native';

import { AppText, GlassButton, PressableScale } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { EventPermissions } from '@/lib/sections';
import { colors } from '@/theme/colors';

interface TourStep {
  icon: LucideIcon;
  title: string;
  content: string;
}

export function eventTourSteps(permissions: EventPermissions): TourStep[] {
  return [
    { icon: Info, title: 'eventTourOverviewTitle', content: 'eventTourOverviewContent' },
    ...(permissions.canViewAnalytics
      ? [
          { icon: Activity, title: 'eventTourStatsTitle', content: 'eventTourStatsContent' },
          { icon: BarChart3, title: 'eventTourAnalyticsTitle', content: 'eventTourAnalyticsContent' },
        ]
      : []),
    ...(permissions.hasOrdersAccess
      ? [{ icon: ListChecks, title: 'eventTourOrdersTitle', content: 'eventTourOrdersContent' }]
      : []),
  ];
}

export function EventTourSheet({ permissions, onClose }: { permissions: EventPermissions; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const iconTint = useThemeColor(colors.links, colors.dark.text);
  const [index, setIndex] = useState(0);
  const steps = eventTourSteps(permissions);
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;
  const Icon = step.icon;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/35">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <View
          className="rounded-t-[28px] bg-white px-4 pt-3 dark:bg-dark-surface"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="mb-3 h-[5px] w-9 self-center rounded-full bg-app-border dark:bg-dark-border" />
          <View className="flex-row items-center justify-between">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-links/10 dark:bg-white/10">
              <Icon size={20} color={iconTint} />
            </View>
            <View className="flex-row items-center gap-3">
              <AppText className="font-gilroy-semibold text-[13px] text-muted dark:text-dark-muted">{`${index + 1} / ${steps.length}`}</AppText>
              <PressableScale
                onPress={onClose}
                accessibilityLabel={t('Skip')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </PressableScale>
            </View>
          </View>
          <AppText className="mt-4 font-gilroy-bold text-[18px] leading-[24px]">{t(step.title)}</AppText>
          <AppText className="mt-1.5 font-gilroy-medium text-[14px] leading-[20px] text-muted dark:text-dark-muted">
            {t(step.content)}
          </AppText>
          <View className="mt-6 flex-row gap-2.5">
            {index > 0 ? (
              <View className="flex-1">
                <GlassButton label={t('Back')} variant="secondary" onPress={() => setIndex((current) => current - 1)} />
              </View>
            ) : null}
            <View className="flex-1">
              <GlassButton
                label={isLast ? t('Done') : t('Next')}
                onPress={() => (isLast ? onClose() : setIndex((current) => current + 1))}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
