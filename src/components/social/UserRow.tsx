import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import type { FollowUser } from '@/types/api';
import { AppText, PressableScale } from '@/components/ui';

export function followUserName(user: {
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
}): string {
  return (
    user.organization_name?.trim() ||
    `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
    '—'
  );
}

export function isListableUser(user: {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  is_email_confirmed?: boolean;
}): boolean {
  if (user.id === 22) return false;
  if (user.is_email_confirmed === false) return false;
  return Boolean((user.first_name && user.last_name) || user.organization_name);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function UserAvatar({
  uri,
  name,
  size = 44,
  recyclingKey,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  recyclingKey?: string;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center overflow-hidden bg-brand/20 dark:bg-dark-elevated"
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey ?? uri}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <AppText className="font-gilroy-bold text-brand-dark dark:text-dark-text" style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </AppText>
      )}
    </View>
  );
}

export const UserRow = memo(function UserRow({
  user,
  onPress,
  showChevron = true,
  subtitle,
  isFollowing,
}: {
  user: FollowUser;
  onPress: () => void;
  showChevron?: boolean;
  subtitle?: string;
  isFollowing?: boolean;
}) {
  const { t } = useTranslation();
  const name = followUserName(user);
  const resolvedSubtitle = subtitle;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={name} className={cn('flex-row items-center gap-3 py-3')}>
      <UserAvatar uri={user.profile_image} name={name} size={46} recyclingKey={String(user.id)} />
      <View className="flex-1">
        <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
          {name}
        </AppText>
        {resolvedSubtitle ? (
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
            {resolvedSubtitle}
          </AppText>
        ) : null}
      </View>
      {isFollowing ? (
        <View className="rounded-full bg-primary/10 px-2.5 py-1 dark:bg-white/10">
          <AppText className="font-gilroy-semibold text-[11px] text-primary/80 dark:text-dark-text/80">
            {t('Following')}
          </AppText>
        </View>
      ) : null}
      {showChevron ? <ChevronRight size={18} color={colors.muted} /> : null}
    </PressableScale>
  );
});
