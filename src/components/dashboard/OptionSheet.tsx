import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { AppText, PressableScale } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function OptionSheet<T extends string>({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: SheetOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const checkColor = useThemeColor(colors.primary, colors.dark.text);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <View className="rounded-t-[20px] bg-app-bg pb-8 pt-3 dark:bg-dark-bg">
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-black/15 dark:bg-white/20" />
          <AppText className="px-5 pb-2 font-gilroy-bold text-[18px] leading-[24px]">{title}</AppText>
          {options.map((option) => (
            <PressableScale
              key={option.value}
              onPress={() => {
                haptics.selection();
                onSelect(option.value);
                onClose();
              }}
              accessibilityLabel={option.label}
              className="flex-row items-center justify-between px-5 py-3.5"
            >
              <View className="flex-row items-center gap-2">
                <AppText className="font-gilroy-semibold text-[15px] leading-[20px]">{option.label}</AppText>
                {option.hint ? <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">{option.hint}</AppText> : null}
              </View>
              {option.value === value ? <Check size={18} color={checkColor} /> : null}
            </PressableScale>
          ))}
        </View>
      </View>
    </Modal>
  );
}
