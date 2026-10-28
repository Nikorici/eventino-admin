import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';

import { AppText, PressableScale } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { colors } from '@/theme/colors';

export function ToolRow({
  icon: Icon,
  label,
  onPress,
  last,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const chevronColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const divider = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} className="w-full">
      <View
        className="flex-row items-center gap-3 py-3.5"
        style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: divider }}
      >
        <View className="h-9 w-9 items-center justify-center rounded-[9px] bg-black/[0.04] dark:bg-white/10">
          <Icon size={18} color={iconColor} />
        </View>
        <AppText className="flex-1 font-gilroy-semibold text-[15px]">{label}</AppText>
        <ChevronRight size={18} color={chevronColor} />
      </View>
    </PressableScale>
  );
}

export function ToolSection({ title, children }: { title?: string; children: ReactNode }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2">
      {title ? <AppText className="font-gilroy-semibold text-[18px]">{title}</AppText> : null}
      <View className="rounded-[14px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        {children}
      </View>
    </View>
  );
}
