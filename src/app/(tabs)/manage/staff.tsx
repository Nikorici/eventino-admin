import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Switch, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, Pencil, Search, Shield, Trash2, UserPlus, X } from 'lucide-react-native';

import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { eventPermissions } from '@/lib/sections';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import {
  useAddEventStaffMutation,
  useGetEventStaffQuery,
  useRemoveEventStaffMutation,
  useSearchAvailableStaffUsersQuery,
  useUpdateEventStaffMutation,
  type AvailableStaffUser,
  type EventStaffMember,
  type StaffPermissionFlags,
  type StaffPermissions,
  type StaffUserDetails,
} from '@/store/api/staffApi';
import {
  AppText,
  EmptyState,
  GlassHeader,
  GlassInput,
  PressableScale,
  Screen,
  SegmentedControl,
  Skeleton,
  ToastHost,
} from '@/components/ui';

const ACCENT_GREEN = '#34c759';
const ACCENT_BLUE = '#61859d';

const ACCESS_FIELDS: { key: keyof StaffPermissionFlags; label: string }[] = [
  { key: 'can_view_buyers', label: 'View Buyers' },
  { key: 'can_view_analytics', label: 'View Analytics' },
  { key: 'can_manage_tickets', label: 'Manage Tickets' },
  { key: 'can_manage_orders', label: 'Manage Orders' },
  { key: 'can_manage_forms', label: 'Manage Forms' },
  { key: 'can_manage_scanners', label: 'Manage Scanners' },
];

const VIEW_ONLY_PRESET: StaffPermissions = {
  permission: 'view_only',
  can_view_buyers: true,
  can_view_analytics: true,
  can_manage_tickets: false,
  can_manage_orders: false,
  can_manage_forms: false,
  can_manage_scanners: false,
};

const FULL_ACCESS_PRESET: StaffPermissions = {
  permission: 'full',
  can_view_buyers: true,
  can_view_analytics: true,
  can_manage_tickets: true,
  can_manage_orders: true,
  can_manage_forms: true,
  can_manage_scanners: true,
};

function permissionsOf(staff: EventStaffMember): StaffPermissions {
  return {
    permission: staff.permission,
    can_view_buyers: staff.can_view_buyers,
    can_view_analytics: staff.can_view_analytics,
    can_manage_tickets: staff.can_manage_tickets,
    can_manage_orders: staff.can_manage_orders,
    can_manage_forms: staff.can_manage_forms,
    can_manage_scanners: staff.can_manage_scanners,
  };
}

function permissionSummary(permissions: StaffPermissions, t: TFunction): string {
  if (permissions.permission === 'full') return t('Full Access');
  const active = ACCESS_FIELDS.filter((field) => permissions[field.key]).map((field) => t(field.label));
  if (active.length === 0) return t('No Access');
  if (active.length <= 2) return active.join(', ');
  return `${active.length} ${t('permissions')}`;
}

function staffUserLabel(user: StaffUserDetails): string {
  if (user.is_organization && user.organization_name) return user.organization_name;
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || '—';
}

function UserAvatar({ user, size }: { user: StaffUserDetails; size: number }) {
  const label = staffUserLabel(user);
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-brand/20 dark:bg-dark-elevated"
      style={{ width: size, height: size }}
    >
      {user.profile_image ? (
        <Image source={{ uri: user.profile_image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <AppText className="font-gilroy-bold text-[14px] text-primary dark:text-dark-text leading-[19px]">
          {label.slice(0, 1).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

function PermissionEditor({ value, onChange }: { value: StaffPermissions; onChange: (next: StaffPermissions) => void }) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Access Level')}</AppText>
        <SegmentedControl
          options={[
            { value: 'full', label: t('Full Access') },
            { value: 'view_only', label: t('View Only') },
          ]}
          value={value.permission}
          onChange={(level) => onChange(level === 'full' ? FULL_ACCESS_PRESET : VIEW_ONLY_PRESET)}
        />
      </View>
      <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        {ACCESS_FIELDS.map((field, index) => (
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
                const updated: StaffPermissions = { ...value, [field.key]: next };
                updated.permission = ACCESS_FIELDS.every((entry) => updated[entry.key]) ? 'full' : 'view_only';
                onChange(updated);
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function StaffRow({
  staff,
  canManage,
  onEdit,
  onRemove,
  removing,
}: {
  staff: EventStaffMember;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  const editTint = useThemeColor(colors.primary, colors.dark.text);
  const isFull = staff.permission === 'full';
  return (
    <View className="flex-row items-center gap-3 py-3">
      <UserAvatar user={staff.user_details} size={40} />
      <View className="flex-1">
        <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
          {staffUserLabel(staff.user_details)}
        </AppText>
        {staff.user_details.email ? (
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted leading-[16px]">
            {staff.user_details.email}
          </AppText>
        ) : null}
        <View
          className="mt-1 h-5 justify-center self-start rounded-full px-2.5"
          style={{ backgroundColor: isFull ? `${ACCENT_GREEN}22` : `${ACCENT_BLUE}22` }}
        >
          <AppText className="font-gilroy-semibold text-[11px] leading-[14px]" style={{ color: isFull ? ACCENT_GREEN : ACCENT_BLUE }}>
            {permissionSummary(permissionsOf(staff), t)}
          </AppText>
        </View>
      </View>
      {canManage ? (
        <>
          <PressableScale
            onPress={onEdit}
            disabled={removing}
            accessibilityLabel={t('Edit Staff Permissions')}
            className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
          >
            <Pencil size={16} color={editTint} />
          </PressableScale>
          <PressableScale
            onPress={onRemove}
            disabled={removing}
            accessibilityLabel={t('Remove staff member')}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: `${colors.danger}22` }}
          >
            {removing ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 size={16} color={colors.danger} />}
          </PressableScale>
        </>
      ) : null}
    </View>
  );
}

function SheetModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="flex-1 pr-3 font-gilroy-bold text-[20px] leading-[26px]">{title}</AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}

function SheetSubmitButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  icon: typeof Check;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const tint = useThemeColor(colors.white, colors.primary);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'mt-5 h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white',
        disabled && !loading && 'opacity-50',
      )}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          <Icon size={18} color={tint} />
          <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary leading-[21px]">{label}</AppText>
        </>
      )}
    </PressableScale>
  );
}

function StaffRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </View>
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </View>
  );
}

export default function EventStaffScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const user = useAppSelector((s) => s.auth.user);
  const { eventId, data: event, isLoading: eventLoading } = useSelectedEvent();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const spinnerColor = useThemeColor('#2b3a44', '#f9f9f9');
  const numericId = eventId ?? 0;
  const isCancelled = Boolean(event?.is_cancelled);
  const canManage = !eventPermissions(event, user).isStaffMember && !isCancelled;
  const skipStaff = !numericId || !event || isCancelled;

  const {
    data: staff,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetEventStaffQuery(numericId, { skip: skipStaff });

  const [addStaff, { isLoading: adding }] = useAddEventStaffMutation();
  const [updateStaff, { isLoading: saving }] = useUpdateEventStaffMutation();
  const [removeStaff] = useRemoveEventStaffMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AvailableStaffUser | null>(null);
  const [newPermissions, setNewPermissions] = useState<StaffPermissions>(VIEW_ONLY_PRESET);
  const [editingStaff, setEditingStaff] = useState<EventStaffMember | null>(null);
  const [editPermissions, setEditPermissions] = useState<StaffPermissions>(VIEW_ONLY_PRESET);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: searchResults, isFetching: searching } = useSearchAvailableStaffUsersQuery(
    { eventId: numericId, search },
    { skip: !addOpen || !numericId || search.length < 2 },
  );

  const openAdd = useCallback(() => {
    haptics.light();
    setSearchInput('');
    setSearch('');
    setSelectedUser(null);
    setNewPermissions(VIEW_ONLY_PRESET);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((member: EventStaffMember) => {
    haptics.selection();
    setEditPermissions(permissionsOf(member));
    setEditingStaff(member);
  }, []);

  const submitAdd = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await addStaff({ event: numericId, user: selectedUser.id, ...newPermissions }).unwrap();
      toast(`${staffUserLabel(selectedUser)} ${t('added as staff')}`, 'success');
      setAddOpen(false);
    } catch (error) {
      toast(extractApiError(error) ?? t('Failed to add staff member'), 'error');
    }
  }, [selectedUser, addStaff, numericId, newPermissions, toast, t]);

  const submitEdit = useCallback(async () => {
    if (!editingStaff) return;
    try {
      await updateStaff({ staffId: editingStaff.id, permissions: editPermissions }).unwrap();
      toast(t('Staff permissions updated'), 'success');
      setEditingStaff(null);
    } catch (error) {
      toast(extractApiError(error) ?? t('Failed to update permissions'), 'error');
    }
  }, [editingStaff, editPermissions, updateStaff, toast, t]);

  const confirmRemove = useCallback(
    async (member: EventStaffMember) => {
      setRemovingId(member.id);
      try {
        await removeStaff(member.id).unwrap();
        toast(`${staffUserLabel(member.user_details)} ${t('removed')}`, 'success');
      } catch (error) {
        toast(extractApiError(error) ?? t('Failed to remove staff member'), 'error');
      } finally {
        setRemovingId(null);
      }
    },
    [removeStaff, toast, t],
  );

  const onRemove = useCallback(
    (member: EventStaffMember) => {
      haptics.medium();
      confirmAction({
        title: t('Remove staff member'),
        message: t('Are you sure you want to remove this staff member?'),
        cancelLabel: t('Cancel'),
        confirmLabel: t('Remove'),
        destructive: true,
        onConfirm: () => void confirmRemove(member),
      });
    },
    [t, confirmRemove],
  );

  const staffList = staff ?? [];
  const results = searchResults ?? [];

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Event Staff')}
        onBack={() => navigate.back()}
        right={
          canManage ? (
            <PressableScale
              onPress={openAdd}
              accessibilityLabel={t('Add Staff')}
              className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <UserPlus size={18} color={headerIconTint} />
            </PressableScale>
          ) : null
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              if (!skipStaff) void refetch();
            }}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] text-muted leading-[19px]">
            {canManage || isCancelled
              ? t('Manage who can access and manage your event dashboard')
              : t('Only the event owner can manage staff members.')}
          </AppText>

          {isCancelled ? (
            <EmptyState icon={Shield} title={t('Event cancelled, no event staff.')} />
          ) : eventLoading || isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-3 w-32" />
              <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                {[0, 1, 2].map((key) => (
                  <View
                    key={key}
                    className={key > 0 ? 'border-t' : ''}
                    style={key > 0 ? { borderColor: rowDivider } : undefined}
                  >
                    <StaffRowSkeleton />
                  </View>
                ))}
              </View>
            </View>
          ) : isError ? (
            <EmptyState
              icon={Shield}
              title={t('Failed to load staff')}
              actionLabel={t('Try again')}
              onAction={() => {
                void refetch();
              }}
            />
          ) : staffList.length === 0 ? (
            <EmptyState
              icon={Shield}
              title={t('No staff members')}
              message={canManage ? t('Add users who can help manage your event') : undefined}
              actionLabel={canManage ? t('Add Staff') : undefined}
              onAction={canManage ? openAdd : undefined}
            />
          ) : (
            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[13px] uppercase tracking-[0.52px] text-muted leading-[17px]">
                {`${staffList.length} ${staffList.length === 1 ? t('Staff Member') : t('Staff Members')}`}
              </AppText>
              <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                {staffList.map((member, index) => (
                  <View
                    key={member.id}
                    className={index > 0 ? 'border-t' : ''}
                    style={index > 0 ? { borderColor: rowDivider } : undefined}
                  >
                    <StaffRow
                      staff={member}
                      canManage={canManage}
                      removing={removingId === member.id}
                      onEdit={() => openEdit(member)}
                      onRemove={() => onRemove(member)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <SheetModal visible={addOpen} onClose={() => setAddOpen(false)} title={t('Add Staff')}>
        <ScrollView style={{ maxHeight: height * 0.72 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="gap-4">
            <View className="gap-2">
              <GlassInput
                placeholder={t('Search users by name or email...')}
                accessibilityLabel={t('Search users')}
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Search size={18} color={colors.muted} />}
                rightIcon={searching ? <ActivityIndicator size="small" color={colors.muted} /> : undefined}
              />
              {results.length > 0 ? (
                <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                  {results.map((result, index) => {
                    const active = selectedUser?.id === result.id;
                    return (
                      <Pressable
                        key={result.id}
                        onPress={() => {
                          haptics.selection();
                          setSelectedUser(result);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={staffUserLabel(result)}
                        className={cn('flex-row items-center gap-3 py-3', index > 0 && 'border-t')}
                        style={index > 0 ? { borderColor: rowDivider } : undefined}
                      >
                        <UserAvatar user={result} size={36} />
                        <View className="flex-1">
                          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
                            {staffUserLabel(result)}
                          </AppText>
                          {result.email ? (
                            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted leading-[16px]">
                              {result.email}
                            </AppText>
                          ) : null}
                        </View>
                        {active ? <Check size={18} color={ACCENT_GREEN} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {search.length >= 2 && !searching && results.length === 0 ? (
                <AppText className="py-2 text-center font-gilroy-medium text-[13px] text-muted leading-[17px]">{t('No users found')}</AppText>
              ) : null}
            </View>

            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Permissions for new staff member')}</AppText>
              <PermissionEditor value={newPermissions} onChange={setNewPermissions} />
            </View>
          </View>
        </ScrollView>
        <SheetSubmitButton
          label={t('Add Staff')}
          icon={UserPlus}
          onPress={() => {
            void submitAdd();
          }}
          disabled={!selectedUser}
          loading={adding}
        />
      </SheetModal>

      <SheetModal visible={editingStaff != null} onClose={() => setEditingStaff(null)} title={t('Edit Staff Permissions')}>
        {editingStaff ? (
          <>
            <ScrollView style={{ maxHeight: height * 0.72 }} showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View
                  className="flex-row items-center gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                  style={{ borderColor: cardBorder }}
                >
                  <UserAvatar user={editingStaff.user_details} size={40} />
                  <View className="flex-1">
                    <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
                      {staffUserLabel(editingStaff.user_details)}
                    </AppText>
                    {editingStaff.user_details.email ? (
                      <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted leading-[16px]">
                        {editingStaff.user_details.email}
                      </AppText>
                    ) : null}
                  </View>
                </View>

                <View className="gap-2">
                  <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Update permissions')}</AppText>
                  <PermissionEditor value={editPermissions} onChange={setEditPermissions} />
                </View>
              </View>
            </ScrollView>
            <SheetSubmitButton
              label={t('Save')}
              icon={Check}
              onPress={() => {
                void submitEdit();
              }}
              disabled={false}
              loading={saving}
            />
          </>
        ) : null}
      </SheetModal>
    </Screen>
  );
}
