import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, PenTool, Search, Shield, Trash2, UploadCloud, UserPlus } from 'lucide-react-native';

import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useToast } from '@/hooks/useToast';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import { PrimaryButton, SheetModal } from '@/components/merch/merchParts';
import {
  useAddDelegateMutation,
  useGetMyDelegatesQuery,
  useRemoveDelegateMutation,
  useSearchAvailableDelegateUsersQuery,
  useUpdateDelegateMutation,
  type AccountDelegate,
  type AvailableDelegateUser,
  type DelegatePermissionFlags,
  type DelegateUserDetails,
} from '@/store/api/teamApi';
import { AppText, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton } from '@/components/ui';

const ACCENT_GREEN = '#34c759';
const ACCENT_BLUE = '#61859d';

const PERMISSION_FIELDS: { key: keyof DelegatePermissionFlags; label: string; short: string; icon: typeof PenTool; tone: string }[] = [
  { key: 'can_edit', label: 'Edit my events', short: 'Edit', icon: PenTool, tone: ACCENT_BLUE },
  { key: 'can_post', label: 'Post events on my behalf', short: 'Post', icon: UploadCloud, tone: ACCENT_GREEN },
];

const BLANK_PERMISSIONS: DelegatePermissionFlags = { can_edit: false, can_post: false, can_delete: false };
const DEFAULT_NEW_PERMISSIONS: DelegatePermissionFlags = { can_edit: true, can_post: false, can_delete: false };

function delegateUserLabel(user: DelegateUserDetails): string {
  if (user.is_organization && user.organization_name) return user.organization_name;
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || '—';
}

function permissionsOf(delegate: AccountDelegate): DelegatePermissionFlags {
  return { can_edit: delegate.can_edit, can_post: delegate.can_post, can_delete: delegate.can_delete };
}

function hasAnyPermission(permissions: DelegatePermissionFlags): boolean {
  return permissions.can_edit || permissions.can_post || permissions.can_delete;
}

function UserAvatar({ user, size }: { user: DelegateUserDetails; size: number }) {
  const label = delegateUserLabel(user);
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-brand/20"
      style={{ width: size, height: size }}
    >
      {user.profile_image ? (
        <Image source={{ uri: user.profile_image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <AppText className="font-gilroy-bold text-[14px] leading-[19px] text-primary dark:text-dark-text">
          {label.slice(0, 1).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

function UserIdentity({ user }: { user: DelegateUserDetails }) {
  const { t } = useTranslation();
  return (
    <>
      <View className="flex-row items-center gap-1.5">
        <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[14px] leading-[19px]">
          {delegateUserLabel(user)}
        </AppText>
        {user.is_organization ? (
          <View className="h-[18px] justify-center rounded-[6px] bg-black/[0.04] px-1.5 dark:bg-white/10">
            <AppText className="font-gilroy-semibold text-[10px] leading-[13px] text-primary/80 dark:text-dark-text/80">{t('Org')}</AppText>
          </View>
        ) : null}
      </View>
      {user.email ? (
        <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
          {user.email}
        </AppText>
      ) : null}
    </>
  );
}

function PermissionEditor({ value, onChange }: { value: DelegatePermissionFlags; onChange: (next: DelegatePermissionFlags) => void }) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  return (
    <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      {PERMISSION_FIELDS.map((field, index) => (
        <View
          key={field.key}
          className={cn(
            'flex-row items-center justify-between py-2.5',
            index > 0 && 'border-t border-app-border dark:border-dark-border',
          )}
        >
          <AppText className="flex-1 pr-3 font-gilroy-medium text-[14px] leading-[19px]">{t(field.label)}</AppText>
          <Switch
            value={value[field.key]}
            accessibilityLabel={t(field.label)}
            onValueChange={(next) => {
              haptics.selection();
              onChange({ ...value, [field.key]: next });
            }}
            trackColor={{ true: switchTrackOn, false: switchTrackOff }}
            thumbColor={colors.white}
          />
        </View>
      ))}
    </View>
  );
}

function PermissionChips({ delegate }: { delegate: AccountDelegate }) {
  const { t } = useTranslation();
  const active = PERMISSION_FIELDS.filter((field) => delegate[field.key]);
  if (active.length === 0) {
    return (
      <View className="mt-1 self-start rounded-full bg-black/[0.06] px-2.5 py-0.5 dark:bg-white/10">
        <AppText className="font-gilroy-semibold text-[11px] leading-[14px] text-muted dark:text-dark-muted">{t('No permissions')}</AppText>
      </View>
    );
  }
  return (
    <View className="mt-1 flex-row gap-1.5">
      {active.map((field) => {
        const Icon = field.icon;
        return (
          <View
            key={field.key}
            className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: `${field.tone}22` }}
          >
            <Icon size={11} color={field.tone} />
            <AppText className="font-gilroy-semibold text-[11px] leading-[14px]" style={{ color: field.tone }}>
              {t(field.short)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function DelegateRow({
  delegate,
  onEdit,
  onRemove,
  removing,
}: {
  delegate: AccountDelegate;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  const editTint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <View className="flex-row items-center gap-3 py-3">
      <UserAvatar user={delegate.delegate_details} size={40} />
      <View className="flex-1">
        <UserIdentity user={delegate.delegate_details} />
        <PermissionChips delegate={delegate} />
      </View>
      <PressableScale
        onPress={onEdit}
        disabled={removing}
        accessibilityLabel={t('Update permissions')}
        className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
      >
        <Pencil size={16} color={editTint} />
      </PressableScale>
      <PressableScale
        onPress={onRemove}
        disabled={removing}
        accessibilityLabel={t('Remove team member')}
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: `${colors.danger}22` }}
      >
        {removing ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 size={16} color={colors.danger} />}
      </PressableScale>
    </View>
  );
}

function DelegateRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <View className="mt-0.5 flex-row gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </View>
      </View>
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </View>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const spinnerColor = useThemeColor('#2b3a44', '#f9f9f9');
  const buttonTint = useThemeColor(colors.white, colors.primary);

  const { data: delegates, isLoading, isFetching, isError, refetch } = useGetMyDelegatesQuery();

  const [addDelegate, { isLoading: adding }] = useAddDelegateMutation();
  const [updateDelegate, { isLoading: saving }] = useUpdateDelegateMutation();
  const [removeDelegate] = useRemoveDelegateMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AvailableDelegateUser | null>(null);
  const [newPermissions, setNewPermissions] = useState<DelegatePermissionFlags>(DEFAULT_NEW_PERMISSIONS);
  const [editingDelegate, setEditingDelegate] = useState<AccountDelegate | null>(null);
  const [editPermissions, setEditPermissions] = useState<DelegatePermissionFlags>(BLANK_PERMISSIONS);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: searchResults, isFetching: searching } = useSearchAvailableDelegateUsersQuery(
    { search },
    { skip: !addOpen || search.length < 2 },
  );

  const openAdd = useCallback(() => {
    haptics.light();
    setSearchInput('');
    setSearch('');
    setSelectedUser(null);
    setNewPermissions(DEFAULT_NEW_PERMISSIONS);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((delegate: AccountDelegate) => {
    haptics.selection();
    setEditPermissions(permissionsOf(delegate));
    setEditingDelegate(delegate);
  }, []);

  const submitAdd = useCallback(async () => {
    if (!selectedUser) return;
    if (!hasAnyPermission(newPermissions)) {
      toast(t('Pick at least one permission'), 'error');
      return;
    }
    try {
      await addDelegate({ delegate: selectedUser.id, ...newPermissions }).unwrap();
      toast(`${delegateUserLabel(selectedUser)} ${t('added to your team')}`, 'success');
      setAddOpen(false);
    } catch (error) {
      toast(extractApiError(error) ?? t('Failed to add delegate'), 'error');
    }
  }, [selectedUser, newPermissions, addDelegate, toast, t]);

  const submitEdit = useCallback(async () => {
    if (!editingDelegate) return;
    try {
      await updateDelegate({ delegateId: editingDelegate.id, permissions: editPermissions }).unwrap();
      toast(t('Permissions updated'), 'success');
      setEditingDelegate(null);
    } catch {
      toast(t('Failed to update'), 'error');
    }
  }, [editingDelegate, editPermissions, updateDelegate, toast, t]);

  const onRemove = useCallback(
    (delegate: AccountDelegate) => {
      haptics.medium();
      confirmAction({
        title: t('Remove team member'),
        message: t('Are you sure you want to remove this team member?'),
        confirmLabel: t('Remove'),
        cancelLabel: t('Cancel'),
        destructive: true,
        onConfirm: () => {
          void (async () => {
            setRemovingId(delegate.id);
            try {
              await removeDelegate(delegate.id).unwrap();
              toast(t('Removed'), 'success');
            } catch {
              toast(t('Failed to remove'), 'error');
            } finally {
              setRemovingId(null);
            }
          })();
        },
      });
    },
    [removeDelegate, toast, t],
  );

  const delegateList = delegates ?? [];
  const results = searchResults ?? [];

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('My Team')}
        onBack={navigate.back}
        right={
          <PressableScale
            onPress={openAdd}
            accessibilityLabel={t('Add team member')}
            className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
          >
            <UserPlus size={18} color={headerIconTint} />
          </PressableScale>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
            }}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
            {t('Add a delegate to let them post, edit, or delete your events on your behalf.')}
          </AppText>

          {isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-3 w-32" />
              <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                {[0, 1, 2].map((key) => (
                  <View key={key} className={key > 0 ? 'border-t' : ''} style={key > 0 ? { borderColor: rowDivider } : undefined}>
                    <DelegateRowSkeleton />
                  </View>
                ))}
              </View>
            </View>
          ) : isError ? (
            <EmptyState
              icon={Shield}
              title={t('Failed to load team')}
              actionLabel={t('Try again')}
              onAction={() => {
                void refetch();
              }}
            />
          ) : delegateList.length === 0 ? (
            <EmptyState
              icon={Shield}
              title={t('No team members yet')}
              message={t('Add a delegate to let them post, edit, or delete your events on your behalf.')}
              actionLabel={t('Add team member')}
              onAction={openAdd}
            />
          ) : (
            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[13px] leading-[17px] uppercase tracking-[0.52px] text-muted dark:text-dark-muted">
                {`${delegateList.length} ${delegateList.length === 1 ? t('team member') : t('team members')}`}
              </AppText>
              <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                {delegateList.map((delegate, index) => (
                  <View
                    key={delegate.id}
                    className={index > 0 ? 'border-t' : ''}
                    style={index > 0 ? { borderColor: rowDivider } : undefined}
                  >
                    <DelegateRow
                      delegate={delegate}
                      removing={removingId === delegate.id}
                      onEdit={() => openEdit(delegate)}
                      onRemove={() => onRemove(delegate)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <SheetModal visible={addOpen} onClose={() => setAddOpen(false)} title={t('Add team member')}>
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="gap-4">
            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Step 1 — pick permissions')}</AppText>
              <PermissionEditor value={newPermissions} onChange={setNewPermissions} />
            </View>

            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Step 2 — pick a user to add')}</AppText>
              <GlassInput
                placeholder={t('Search users by name or email...')}
                accessibilityLabel={t('Search users by name or email...')}
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Search size={18} color={colors.muted} />}
                rightIcon={searching ? <ActivityIndicator size="small" color={colors.muted} /> : undefined}
              />
              {results.length > 0 ? (
                <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                  {results.map((user, index) => {
                    const active = selectedUser?.id === user.id;
                    return (
                      <Pressable
                        key={user.id}
                        onPress={() => {
                          haptics.selection();
                          setSelectedUser(user);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={delegateUserLabel(user)}
                        className={cn('flex-row items-center gap-3 py-3', index > 0 && 'border-t')}
                        style={index > 0 ? { borderColor: rowDivider } : undefined}
                      >
                        <UserAvatar user={user} size={36} />
                        <View className="flex-1">
                          <UserIdentity user={user} />
                        </View>
                        {active ? <Check size={18} color={ACCENT_GREEN} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {search.length >= 2 && searching && results.length === 0 ? (
                <AppText className="py-2 text-center font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('Searching...')}</AppText>
              ) : null}
              {search.length >= 2 && !searching && results.length === 0 ? (
                <AppText className="py-2 text-center font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('No users found')}</AppText>
              ) : null}
            </View>
          </View>
        </ScrollView>
        <View className="mt-5">
          <PrimaryButton
            label={t('Add team member')}
            icon={<UserPlus size={18} color={buttonTint} />}
            onPress={() => {
              void submitAdd();
            }}
            disabled={!selectedUser}
            loading={adding}
          />
        </View>
      </SheetModal>

      <SheetModal visible={editingDelegate != null} onClose={() => setEditingDelegate(null)} title={t('Update permissions')}>
        {editingDelegate ? (
          <>
            <View className="gap-4">
              <View
                className="flex-row items-center gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                style={{ borderColor: cardBorder }}
              >
                <UserAvatar user={editingDelegate.delegate_details} size={40} />
                <View className="flex-1">
                  <UserIdentity user={editingDelegate.delegate_details} />
                </View>
              </View>
              <PermissionEditor value={editPermissions} onChange={setEditPermissions} />
            </View>
            <View className="mt-5 gap-2">
              <PrimaryButton
                label={t('Save changes')}
                icon={<Check size={18} color={buttonTint} />}
                onPress={() => {
                  void submitEdit();
                }}
                loading={saving}
              />
            </View>
          </>
        ) : null}
      </SheetModal>
    </Screen>
  );
}
