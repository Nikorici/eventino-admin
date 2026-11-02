import { Plus } from 'lucide-react-native';

import { AppText, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

export function FormAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityLabel={label}
      className="w-full flex-row items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#61859d99] bg-links/10 py-3"
    >
      <Plus size={17} color={colors.links} />
      <AppText className="font-gilroy-semibold text-[14px] leading-[19px] text-links dark:text-links">{label}</AppText>
    </PressableScale>
  );
}
