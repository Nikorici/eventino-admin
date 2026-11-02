import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  FileText,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { confirmAction } from '@/components/dashboard/dashboardParts';
import { OrganizerSwitcherSheet, type OrganizerSwitcherSheetHandle } from '@/components/dashboard/OrganizerSwitcher';
import { AppText, Chip, GlassButton, GlassHeader, PressableScale, Screen, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSetThemePreference } from '@/hooks/useThemePreference';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { STORAGE_KEYS, SUPPORTED_LANGUAGES, WEB_ORIGIN, type Language } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { setAppLanguage } from '@/lib/i18n';
import { navigate } from '@/lib/nav';
import { cache } from '@/lib/storage';
import { useGetUserQuery, useUpdateUserMutation } from '@/store/api/usersApi';
import { useAppSelector } from '@/store/hooks';
import type { User } from '@/types/api';
import { colors } from '@/theme/colors';

const languageLabels: Record<Language, string> = { en: 'EN', ro: 'RO', ru: 'RU' };
const themeOptions = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

function displayNameOf(profile: User): string {
  return (
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() ||
    profile.organization_name?.trim() ||
    profile.email
  );
}

function formatDeletionDate(value: string): string {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function deletionKey(userId: number): string {
  return `${STORAGE_KEYS.scheduledDeletionDate}:${userId}`;
}

function mailPermissionKey(userId: number): string {
  return `se_m_p:${userId}`;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText className="px-1 pb-1 font-gilroy-semibold text-[13px] leading-[17px] uppercase tracking-[0.52px] text-muted dark:text-dark-muted">
      {children}
    </AppText>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onPress,
  danger,
  right,
  first,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  first?: boolean;
}) {
  const isDark = useColorScheme() === 'dark';
  const color = danger ? colors.danger : isDark ? colors.dark.text : colors.primary;
  const content = (
    <View
      className={cn(
        'flex-1 flex-row items-center gap-3 py-3.5',
        !first && 'border-t border-app-border dark:border-dark-border',
      )}
    >
      <View className="h-9 w-9 items-center justify-center rounded-[9px]" style={{ backgroundColor: `${color}14` }}>
        <Icon size={18} color={color} />
      </View>
      <AppText className={cn('flex-1 font-gilroy-medium text-[15px] leading-[20px]', danger && 'text-danger dark:text-danger')}>
        {label}
      </AppText>
      {right ?? <ChevronRight size={18} color={colors.muted} />}
    </View>
  );
  if (!onPress) {
    return <View className="w-full flex-row items-center bg-app-surface px-4 dark:bg-dark-surface">{content}</View>;
  }
  return (
    <PressableScale
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityLabel={label}
      className="w-full flex-row items-center bg-app-surface px-4 dark:bg-dark-surface"
    >
      {content}
    </PressableScale>
  );
}

function ProfileHeader({ profile }: { profile: User }) {
  const name = displayNameOf(profile);
  return (
    <View className="w-full flex-row items-center gap-3.5 rounded-[16px] bg-app-surface p-4 dark:bg-dark-surface">
      <View className="h-14 w-14 overflow-hidden rounded-full bg-primary">
        {profile.profile_image ? (
          <Image source={{ uri: profile.profile_image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <AppText className="font-gilroy-bold text-lg text-white">{name.slice(0, 1).toUpperCase()}</AppText>
          </View>
        )}
      </View>
      <View className="flex-1">
        <AppText numberOfLines={1} className="font-gilroy-bold text-[17px] leading-[22px]">
          {name}
        </AppText>
        <AppText numberOfLines={1} className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
          {profile.email}
        </AppText>
      </View>
    </View>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <View className="w-full flex-row items-center gap-3.5 rounded-[16px] bg-app-surface p-4 dark:bg-dark-surface">
      <Skeleton className="h-14 w-14 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const { user, logout } = useAuth();
  const themePreference = useAppSelector((state) => state.theme.preference);
  const setThemePreference = useSetThemePreference();
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const organizerSheetRef = useRef<OrganizerSwitcherSheetHandle>(null);

  const userQuery = useGetUserQuery(user?.id ?? 0, { skip: !user });
  const profile = userQuery.data ?? user;
  const [updateUser] = useUpdateUserMutation();

  const [mailPermission, setMailPermission] = useState<boolean | null>(null);
  const [scheduledDeletion, setScheduledDeletion] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentLanguage = (i18n.language ?? 'en').split('-')[0];
  const profileId = profile?.id;
  const profileDeletionDate = profile?.scheduledDeletionDate;

  useEffect(() => {
    if (profileId == null) return;
    let active = true;
    void (async () => {
      const storedMail = await cache.get<boolean>(mailPermissionKey(profileId));
      if (active && typeof storedMail === 'boolean') setMailPermission(storedMail);
      const stored = await cache.get<string>(deletionKey(profileId));
      if (!active) return;
      if (stored) {
        setScheduledDeletion(stored);
      } else if (profileDeletionDate) {
        setScheduledDeletion(profileDeletionDate);
        await cache.set(deletionKey(profileId), profileDeletionDate);
      }
    })();
    return () => {
      active = false;
    };
  }, [profileId, profileDeletionDate]);

  const { refetch } = userQuery;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const patchUser = useCallback(
    (field: string, value: string) => {
      if (profileId == null) return Promise.reject(new Error('no user'));
      const formData = new FormData();
      formData.append(field, value);
      return updateUser({ id: profileId, formData }).unwrap();
    },
    [profileId, updateUser],
  );

  const onToggleMail = useCallback(
    async (next: boolean) => {
      haptics.selection();
      setMailPermission(next);
      try {
        await patchUser('send_mail_permission', next ? 'true' : 'false');
        if (profileId != null) void cache.set(mailPermissionKey(profileId), next);
        toast(
          next ? t('Email notifications activated successfully!') : t('Email notifications deactivated successfully!'),
          'success',
        );
      } catch {
        setMailPermission(!next);
        toast(t('Please try again.'), 'error');
      }
    },
    [patchUser, profileId, toast, t],
  );

  const onScheduleDeletion = useCallback(() => {
    if (profileId == null) return;
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 7);
    const iso = deletionDate.toISOString();
    setScheduledDeletion(iso);
    void cache.set(deletionKey(profileId), iso);
    void patchUser('scheduledDeletionDate', iso).catch(() => undefined);
  }, [profileId, patchUser]);

  const onCancelDeletion = useCallback(() => {
    if (profileId == null) return;
    haptics.light();
    setScheduledDeletion(null);
    void cache.remove(deletionKey(profileId));
    void patchUser('scheduledDeletionDate', '').catch(() => undefined);
  }, [profileId, patchUser]);

  const onDeleteAccount = useCallback(() => {
    confirmAction({
      title: t('Delete account'),
      message: t(
        'Your account will be deleted in 7 days. You can cancel this action anytime before the deletion date.',
      ),
      confirmLabel: t('Schedule Deletion'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: onScheduleDeletion,
    });
  }, [onScheduleDeletion, t]);

  const onLogout = useCallback(async () => {
    haptics.medium();
    await logout();
    navigate.gate();
  }, [logout]);

  const openWebPage = (path: string) => void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}${path}`);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Settings')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top - 4, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-6">
          {profile ? <ProfileHeader profile={profile} /> : <ProfileHeaderSkeleton />}

          {userQuery.isError ? (
            <View className="flex-row items-center gap-3 rounded-[14px] bg-app-surface px-4 py-3 dark:bg-dark-surface">
              <AppText className="flex-1 font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
                {t('Something went wrong.')}
              </AppText>
              <GlassButton label={t('Try again')} variant="ghost" size="sm" onPress={() => void refetch()} />
            </View>
          ) : null}

          {scheduledDeletion ? (
            <View className="gap-3 rounded-[14px] border border-danger/30 bg-danger/[0.06] p-4">
              <AppText className="font-gilroy-semibold text-[14px] leading-[19px] text-danger dark:text-danger">
                {`${t('Profile scheduled for deletion on')} ${formatDeletionDate(scheduledDeletion)}`}
              </AppText>
              <GlassButton label={t('Cancel deletion')} variant="secondary" size="sm" onPress={onCancelDeletion} />
            </View>
          ) : null}

          <View>
            <SectionLabel>{t('Account')}</SectionLabel>
            <View className="overflow-hidden rounded-[14px]">
              <SettingsRow icon={KeyRound} label={t('Change Password')} onPress={navigate.changePassword} first />
              <SettingsRow
                icon={Users}
                label={t('Linked accounts')}
                onPress={() => organizerSheetRef.current?.present()}
              />
            </View>
          </View>

          <View>
            <SectionLabel>{t('Preferences')}</SectionLabel>
            <View className="overflow-hidden rounded-[14px]">
              <SettingsRow
                icon={Mail}
                label={t('Email notifications')}
                first
                right={
                  <Switch
                    value={mailPermission ?? profile?.send_mail_permission ?? true}
                    onValueChange={(next) => void onToggleMail(next)}
                    disabled={!profile}
                    accessibilityLabel={t('Email notifications')}
                    trackColor={{ true: switchTrackOn, false: switchTrackOff }}
                    thumbColor={colors.white}
                  />
                }
              />
            </View>
            <View className="mt-3 flex-row items-center justify-between gap-3 rounded-[14px] bg-app-surface px-4 py-3.5 dark:bg-dark-surface">
              <AppText className="font-gilroy-medium text-[15px] leading-[20px]">{t('Theme')}</AppText>
              <View className="flex-1 flex-row flex-wrap justify-end gap-2">
                {themeOptions.map((option) => (
                  <Chip
                    key={option.key}
                    label={t(option.label)}
                    selected={themePreference === option.key}
                    onPress={() => setThemePreference(option.key)}
                  />
                ))}
              </View>
            </View>
            <View className="mt-3 flex-row items-center justify-between gap-3 rounded-[14px] bg-app-surface px-4 py-3.5 dark:bg-dark-surface">
              <AppText className="font-gilroy-medium text-[15px] leading-[20px]">{t('Language')}</AppText>
              <View className="flex-1 flex-row flex-wrap justify-end gap-2">
                {SUPPORTED_LANGUAGES.map((code) => (
                  <Chip
                    key={code}
                    label={languageLabels[code]}
                    selected={currentLanguage === code}
                    onPress={() => void setAppLanguage(code)}
                  />
                ))}
              </View>
            </View>
          </View>

          <View>
            <SectionLabel>{t('More')}</SectionLabel>
            <View className="overflow-hidden rounded-[14px]">
              <SettingsRow
                icon={LifeBuoy}
                label={t('Help & Support')}
                onPress={() => openWebPage('/help-support')}
                first
              />
              <SettingsRow
                icon={ShieldCheck}
                label={t('Privacy Policy')}
                onPress={() => openWebPage('/privacy-policy')}
              />
              <SettingsRow
                icon={FileText}
                label={t('Terms & Conditions')}
                onPress={() => openWebPage('/terms-of-use')}
              />
            </View>
          </View>

          <View className="overflow-hidden rounded-[14px]">
            <SettingsRow icon={LogOut} label={t('Log out')} onPress={() => void onLogout()} first />
            <SettingsRow icon={Trash2} label={t('Delete account')} onPress={onDeleteAccount} danger />
          </View>

          {Constants.expoConfig?.version ? (
            <AppText className="text-center font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
              {`${t('Version')} ${Constants.expoConfig.version}`}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
      <OrganizerSwitcherSheet ref={organizerSheetRef} />
    </Screen>
  );
}
