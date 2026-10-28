import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Link2Off, Users } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useApplySwitchedSession, useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useGetLinkedAccountsQuery,
  useSwitchAccountMutation,
  useUnlinkAccountMutation,
  type LinkedAccount,
} from '@/store/api/linkedAccountsApi';
import type { User } from '@/types/api';
import { AppText, GlassButton, PressableScale, Skeleton } from '@/components/ui';
import { UserAvatar, followUserName } from '@/components/social/UserRow';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';

const ACCENT_GREEN = '#34c759';
const DANGER_RED = '#ff3b30';

function accountSubtitle(account: LinkedAccount): string {
  return account.nickname?.trim() || account.email;
}

interface AccountRowProps {
  account: LinkedAccount;
  switching: boolean;
  disabled: boolean;
  onSwitch: (account: LinkedAccount) => void;
  onUnlink: (account: LinkedAccount) => void;
}

function AccountRow({ account, switching, disabled, onSwitch, onUnlink }: AccountRowProps) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const name = followUserName(account);

  return (
    <View
      className="flex-row items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <View className="flex-1">
        <PressableScale
          onPress={() => onSwitch(account)}
          disabled={disabled}
          accessibilityLabel={name}
          className="flex-row items-center gap-3"
        >
          <UserAvatar uri={account.profile_image} name={name} size={40} />
          <View className="flex-1">
            <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
              {name}
            </AppText>
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
              {accountSubtitle(account)}
            </AppText>
          </View>
          {switching ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
        </PressableScale>
      </View>
      <PressableScale
        onPress={() => onUnlink(account)}
        disabled={disabled}
        accessibilityLabel={t('Unlink account')}
        className="h-9 w-9 items-center justify-center rounded-full border"
        style={{ borderColor: cardBorder }}
      >
        <Link2Off size={15} color={DANGER_RED} />
      </PressableScale>
    </View>
  );
}

function AccountRowSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </View>
    </View>
  );
}

export interface OrganizerSwitcherSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export const OrganizerSwitcherSheet = forwardRef<OrganizerSwitcherSheetHandle>(function OrganizerSwitcherSheet(_props, ref) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const applySwitchedSession = useApplySwitchedSession();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);

  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '85%'], []);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => modalRef.current?.present(),
      dismiss: () => modalRef.current?.dismiss(),
    }),
    [],
  );

  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
    refetch: refetchAccounts,
  } = useGetLinkedAccountsQuery(undefined, { skip: !isAuthenticated });

  const [switchAccount] = useSwitchAccountMutation();
  const [unlinkAccount] = useUnlinkAccountMutation();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ),
    [],
  );

  const activeName = user ? followUserName(user) : t('Account');

  const handleSwitch = useCallback(
    async (account: LinkedAccount) => {
      if (switchingId != null) return;
      haptics.medium();
      setSwitchingId(account.id);
      try {
        const res = await switchAccount(account.id).unwrap();
        if (!res.access || !res.refresh) {
          toast(t('Failed to switch account'), 'error');
          return;
        }
        const nextUser: User = res.user ?? {
          id: account.id,
          email: account.email,
          first_name: account.first_name ?? undefined,
          last_name: account.last_name ?? undefined,
          profile_image: account.profile_image ?? undefined,
        };
        modalRef.current?.dismiss();
        await applySwitchedSession({ access: res.access, refresh: res.refresh, user: nextUser });
        haptics.success();
        toast(t('Switched organizer'), 'success');
      } catch {
        toast(t('Failed to switch account'), 'error');
      } finally {
        setSwitchingId(null);
      }
    },
    [switchingId, switchAccount, applySwitchedSession, toast, t],
  );

  const handleUnlink = useCallback(
    (account: LinkedAccount) => {
      haptics.medium();
      Alert.alert(t('Unlink account'), t('Unlink this account?'), [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Unlink account'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkAccount(account.id).unwrap();
              toast(t('Account unlinked'), 'success');
            } catch {
              toast(t('Failed to unlink account'), 'error');
            }
          },
        },
      ]);
    },
    [unlinkAccount, toast, t],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: colors.muted }}
      backgroundStyle={{ backgroundColor: isDark ? colors.dark.surface : colors.surface }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-5 px-5 pt-2">
          <AppText className="font-gilroy-bold text-2xl">{t('Accounts')}</AppText>

          <View className="gap-2">
            <AppText className="font-gilroy-semibold text-[12px] uppercase tracking-wide text-muted">
              {t('Active organizer')}
            </AppText>
            <View
              className="flex-row items-center gap-3 rounded-2xl border bg-white px-3 py-3 dark:bg-dark-surface"
              style={{ borderColor: cardBorder }}
            >
              <UserAvatar uri={user?.profile_image} name={activeName} size={44} />
              <View className="flex-1">
                <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
                  {activeName}
                </AppText>
                {user?.email ? (
                  <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
                    {user.email}
                  </AppText>
                ) : null}
              </View>
              <View
                className="h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: ACCENT_GREEN }}
              >
                <Check size={14} color={colors.white} />
              </View>
            </View>
          </View>

          <View className="gap-2">
            <AppText className="font-gilroy-semibold text-[12px] uppercase tracking-wide text-muted">
              {t('Linked accounts')}
            </AppText>

            {accountsLoading ? (
              <View className="gap-2">
                <AccountRowSkeleton />
                <AccountRowSkeleton />
              </View>
            ) : accountsError ? (
              <View className="items-center gap-3 py-4">
                <AppText className="font-gilroy-medium text-[14px] text-muted">{t('Something went wrong.')}</AppText>
                <GlassButton label={t('Try again')} variant="ghost" onPress={() => refetchAccounts()} />
              </View>
            ) : !accounts || accounts.length === 0 ? (
              <View className="items-center gap-2 py-6">
                <Users size={28} color={colors.muted} />
                <AppText className="font-gilroy-medium text-[14px] text-muted">
                  {t('No linked organizers yet.')}
                </AppText>
              </View>
            ) : (
              <View className="gap-2">
                {accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    switching={switchingId === account.id}
                    disabled={switchingId != null}
                    onSwitch={handleSwitch}
                    onUnlink={handleUnlink}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

export function OrganizerSwitcher() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const chevronColor = useThemeColor(colors.primary, colors.dark.text);
  const sheetRef = useRef<OrganizerSwitcherSheetHandle>(null);

  const activeName = user ? followUserName(user) : t('Account');

  const openSheet = useCallback(() => {
    haptics.selection();
    sheetRef.current?.present();
  }, []);

  if (!isAuthenticated) return null;

  return (
    <>
      <PressableScale
        onPress={openSheet}
        accessibilityLabel={t('Switch account')}
        className="h-10 w-10 items-center justify-center"
      >
        <UserAvatar uri={user?.profile_image} name={activeName} size={34} />
        <View
          className="absolute bottom-0 right-0 h-4 w-4 items-center justify-center rounded-full border bg-white dark:bg-dark-surface"
          style={{ borderColor: cardBorder }}
        >
          <ChevronDown size={10} color={chevronColor} />
        </View>
      </PressableScale>

      <OrganizerSwitcherSheet ref={sheetRef} />
    </>
  );
}
