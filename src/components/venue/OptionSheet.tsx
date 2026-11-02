import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react-native';

import { AppText, PressableScale, ToastHost } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

export interface SheetOption {
  value: number | null;
  label: string;
  disabled?: boolean;
}

interface OptionSheetProps {
  title: string;
  options: SheetOption[];
  value: number | null;
  onPick: (next: number | null) => void;
  onClose: () => void;
}

export function OptionSheet({ title, options, value, onPick, onClose }: OptionSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const checkTint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <View className="rounded-t-[24px] bg-app-bg px-5 pt-4 dark:bg-dark-bg" style={{ paddingBottom: insets.bottom + 12, maxHeight: windowHeight * 0.7 }}>
          <View className="mb-3 flex-row items-center justify-between gap-3">
            <AppText className="flex-1 font-gilroy-bold text-[18px]">{title}</AppText>
            <PressableScale onPress={onClose} accessibilityLabel={t('Close')} className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
              <X size={18} color={colors.muted} />
            </PressableScale>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <PressableScale
                    key={String(option.value)}
                    disabled={option.disabled}
                    onPress={() => {
                      haptics.selection();
                      onPick(option.value);
                    }}
                    accessibilityLabel={option.label}
                    className={cn(
                      'min-h-12 flex-row items-center justify-between gap-3 rounded-[12px] border px-4 py-3',
                      active ? 'border-primary bg-black/[0.04] dark:border-white dark:bg-white/10' : 'border-app-border dark:border-dark-border',
                      option.disabled && 'opacity-40',
                    )}
                  >
                    <AppText className="flex-1 font-gilroy-semibold text-[14px]">{option.label}</AppText>
                    {active ? <Check size={16} color={checkTint} /> : null}
                  </PressableScale>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
      <ToastHost />
    </Modal>
  );
}
