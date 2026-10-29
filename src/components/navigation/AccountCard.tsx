import { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, LogOut } from 'lucide-react-native';

import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { OrganizerSwitcherSheet, type OrganizerSwitcherSheetHandle } from '@/components/dashboard/OrganizerSwitcher';
import { UserAvatar, followUserName } from '@/components/social/UserRow';
import { AppText } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColor } from '@/hooks/useThemeColor';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';

import { ToolRow } from './ToolRow';

export function AccountCard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const sheetRef = useRef<OrganizerSwitcherSheetHandle>(null);
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const name = user ? followUserName(user) : t('Account');

  const onLogout = async () => {
    haptics.medium();
    await logout();
    navigate.gate();
  };

  return (
    <View className="rounded-[14px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center gap-3 py-4" style={{ borderBottomWidth: 1, borderBottomColor: cardBorder }}>
        <UserAvatar uri={user?.profile_image} name={name} size={52} />
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-bold text-[17px]">
            {name}
          </AppText>
          {user?.email ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[13px] text-muted">
              {user.email}
            </AppText>
          ) : null}
        </View>
      </View>
      <ToolRow icon={ArrowLeftRight} label={t('Switch account')} onPress={() => sheetRef.current?.present()} />
      <ToolRow icon={LogOut} label={t('Log Out')} onPress={onLogout} last />
      <OrganizerSwitcherSheet ref={sheetRef} />
    </View>
  );
}
