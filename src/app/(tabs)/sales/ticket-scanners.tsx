import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Check,
  Mail,
  MailCheck,
  ScanLine,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react-native";

import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { navigate } from "@/lib/nav";
import { colors } from "@/theme/colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useScreenPadding } from "@/hooks/useScreenPadding";
import { useSelectedEvent } from "@/hooks/useSelectedEvent";
import { eventPermissions } from "@/lib/sections";
import { useAppSelector } from "@/store/hooks";
import { useToast } from "@/hooks/useToast";
import { CARD_BORDER } from "@/components/dashboard/DashboardStats";
import {
  useAddEventScannerMutation,
  useGetEventScannersQuery,
  useGetScannerTicketTypesQuery,
  useInviteScannerByEmailMutation,
  useRemoveEventScannerMutation,
  useSearchAvailableScannerUsersQuery,
  useUpdateEventScannerScopeMutation,
  type AvailableScannerUser,
  type EventScanner,
  type ScannerScope,
  type ScannerTicketType,
  type ScannerUserDetails,
} from "@/store/api/scannersApi";
import {
  AppText,
  Chip,
  EmptyState,
  GlassHeader,
  GlassInput,
  PressableScale,
  Screen,
  Skeleton,
  ToastHost,
} from "@/components/ui";

const ACCENT_GREEN = "#34c759";
const ACCENT_BLUE = "#61859d";
const ACCENT_ORANGE = "#f97316";

const DEFAULT_SCOPE: ScannerScope = { scan_all: true, ticket_type_ids: [] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function scannerUserLabel(user: ScannerUserDetails): string {
  if (user.is_organization && user.organization_name)
    return user.organization_name;
  return (
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
    user.email ||
    "—"
  );
}

function availableUserLabel(user: AvailableScannerUser): string {
  return (
    `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
    user.email ||
    "—"
  );
}

function ticketTypeLabel(type: ScannerTicketType, t: TFunction): string {
  return type.is_archived ? `${type.name} (${t("archived")})` : type.name;
}

function scopeChipLabels(scanner: EventScanner, t: TFunction): string[] {
  if (scanner.scan_all) return [t("All ticket types")];
  if (!scanner.ticket_types?.length) return [t("No ticket types")];
  return scanner.ticket_types.map((type) => type.name);
}

function scopeOf(scanner: EventScanner): ScannerScope {
  if (scanner.scan_all) return DEFAULT_SCOPE;
  return {
    scan_all: false,
    ticket_type_ids: (scanner.ticket_types ?? []).map((type) => type.id),
  };
}

function ScannerAvatar({
  user,
  size,
}: {
  user: ScannerUserDetails;
  size: number;
}) {
  const label = scannerUserLabel(user);
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full bg-brand/20 dark:bg-dark-elevated"
      style={{ width: size, height: size }}
    >
      {user.profile_image ? (
        <Image
          source={{ uri: user.profile_image }}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <AppText className="font-gilroy-bold text-[14px] text-primary dark:text-dark-text">
          {label.slice(0, 1).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

function ScopePicker({
  value,
  onChange,
  ticketTypes,
}: {
  value: ScannerScope;
  onChange: (next: ScannerScope) => void;
  ticketTypes: ScannerTicketType[];
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor("#d1d1d6", colors.dark.elevated);
  return (
    <View className="gap-3">
      <View
        className="flex-row items-center justify-between rounded-[12px] border bg-white px-4 py-2.5 dark:bg-dark-surface"
        style={{ borderColor: cardBorder }}
      >
        <AppText className="flex-1 pr-3 font-gilroy-medium text-[14px]">
          {t("Scan all ticket types")}
        </AppText>
        <Switch
          value={value.scan_all}
          onValueChange={(next) => {
            haptics.selection();
            onChange({
              scan_all: next,
              ticket_type_ids: next ? [] : value.ticket_type_ids,
            });
          }}
          trackColor={{ true: switchTrackOn, false: switchTrackOff }}
          thumbColor={colors.white}
        />
      </View>
      {!value.scan_all ? (
        ticketTypes.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {ticketTypes.map((type) => {
              const selected = value.ticket_type_ids.includes(type.id);
              return (
                <Chip
                  key={type.id}
                  label={ticketTypeLabel(type, t)}
                  selected={selected}
                  onPress={() =>
                    onChange({
                      scan_all: false,
                      ticket_type_ids: selected
                        ? value.ticket_type_ids.filter((id) => id !== type.id)
                        : [...value.ticket_type_ids, type.id],
                    })
                  }
                />
              );
            })}
          </View>
        ) : (
          <AppText className="font-gilroy-medium text-[13px] text-muted">
            {t("No ticket types")}
          </AppText>
        )
      ) : null}
    </View>
  );
}

function ScannerRow({
  scanner,
  onEditScope,
  onRemove,
  removing,
  canManage,
}: {
  scanner: EventScanner;
  canManage: boolean;
  onEditScope: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useTranslation();
  const email = scanner.user_details.email || scanner.invite_email || "";
  const chipColor = scanner.scan_all ? ACCENT_GREEN : ACCENT_BLUE;
  return (
    <View className="flex-row items-start gap-3 py-3">
      <ScannerAvatar user={scanner.user_details} size={40} />
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <AppText
            numberOfLines={1}
            className="shrink font-gilroy-semibold text-[14px]"
          >
            {scannerUserLabel(scanner.user_details)}
          </AppText>
          {scanner.is_pending_invite ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${ACCENT_ORANGE}22` }}
            >
              <AppText
                className="font-gilroy-semibold text-[10px]"
                style={{ color: ACCENT_ORANGE }}
              >
                {t("Pending invite")}
              </AppText>
            </View>
          ) : null}
        </View>
        {email ? (
          <AppText
            numberOfLines={1}
            className="font-gilroy-medium text-[12px] text-muted"
          >
            {email}
          </AppText>
        ) : null}
        <Pressable
          onPress={() => {
            haptics.selection();
            onEditScope();
          }}
          disabled={removing || !canManage}
          accessibilityRole="button"
          accessibilityLabel={t("Edit scanner scope")}
          className="mt-1.5 flex-row flex-wrap gap-1.5 self-start"
        >
          {scopeChipLabels(scanner, t).map((label, index) => (
            <View
              key={`${index}-${label}`}
              className="rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: `${chipColor}22` }}
            >
              <AppText
                className="font-gilroy-semibold text-[11px]"
                style={{ color: chipColor }}
              >
                {label}
              </AppText>
            </View>
          ))}
        </Pressable>
      </View>
      {canManage ? (
        <PressableScale
          onPress={onRemove}
          disabled={removing}
          accessibilityLabel={t("Remove scanner")}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.danger}22` }}
        >
          {removing ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Trash2 size={16} color={colors.danger} />
          )}
        </PressableScale>
      ) : null}
    </View>
  );
}

function SheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="flex-1 pr-3 font-gilroy-bold text-[20px]">
                {title}
              </AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t("Close")}
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
        "mt-5 h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white",
        disabled && !loading && "opacity-50",
      )}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          <Icon size={18} color={tint} />
          <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">
            {label}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

function ScannerRowSkeleton() {
  return (
    <View className="flex-row items-start gap-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <View className="mt-0.5 flex-row gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </View>
      </View>
      <Skeleton className="h-9 w-9 rounded-full" />
    </View>
  );
}

export default function TicketScannersScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const user = useAppSelector((s) => s.auth.user);
  const { eventId, data: event, isLoading: eventLoading } = useSelectedEvent();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor("#f0f2f8", colors.dark.border);
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const numericId = eventId ?? 0;
  const permissions = eventPermissions(event, user);
  const canManageScanners =
    permissions.isEventOwner || permissions.isSystemStaff;
  const isCancelled = Boolean(event?.is_cancelled);
  const skipScanners = !numericId || !event || isCancelled;

  const {
    data: scanners,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetEventScannersQuery(numericId, { skip: skipScanners });
  const { data: ticketTypes } = useGetScannerTicketTypesQuery(numericId, {
    skip: skipScanners,
  });

  const [addScanner, { isLoading: adding }] = useAddEventScannerMutation();
  const [inviteScanner, { isLoading: inviting }] =
    useInviteScannerByEmailMutation();
  const [updateScope, { isLoading: savingScope }] =
    useUpdateEventScannerScopeMutation();
  const [removeScanner] = useRemoveEventScannerMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AvailableScannerUser | null>(
    null,
  );
  const [addScope, setAddScope] = useState<ScannerScope>(DEFAULT_SCOPE);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteScope, setInviteScope] = useState<ScannerScope>(DEFAULT_SCOPE);
  const [inviteResult, setInviteResult] = useState<{
    email: string;
    inviteSent: boolean;
  } | null>(null);
  const [editingScanner, setEditingScanner] = useState<EventScanner | null>(
    null,
  );
  const [editScope, setEditScope] = useState<ScannerScope>(DEFAULT_SCOPE);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: searchResults, isFetching: searching } =
    useSearchAvailableScannerUsersQuery(
      { eventId: numericId, search, limit: 5 },
      { skip: !addOpen || !numericId || search.length < 2 },
    );

  const openAdd = useCallback(() => {
    haptics.light();
    setSearchInput("");
    setSearch("");
    setSelectedUser(null);
    setAddScope(DEFAULT_SCOPE);
    setAddOpen(true);
  }, []);

  const openInvite = useCallback(() => {
    haptics.light();
    setAddOpen(false);
    setInviteEmail("");
    setInviteScope(DEFAULT_SCOPE);
    setInviteResult(null);
    setInviteOpen(true);
  }, []);

  const openEditScope = useCallback((scanner: EventScanner) => {
    setEditScope(scopeOf(scanner));
    setEditingScanner(scanner);
  }, []);

  const validateScope = useCallback(
    (scope: ScannerScope) => {
      if (!scope.scan_all && scope.ticket_type_ids.length === 0) {
        toast(t("Select at least one ticket type or enable scan all"), "error");
        return false;
      }
      return true;
    },
    [toast, t],
  );

  const submitAdd = useCallback(async () => {
    if (!selectedUser) return;
    if (!validateScope(addScope)) return;
    try {
      await addScanner({
        event: numericId,
        user: selectedUser.id,
        ...addScope,
      }).unwrap();
      toast(
        `${availableUserLabel(selectedUser)} ${t("added as scanner")}`,
        "success",
      );
      setAddOpen(false);
    } catch {
      toast(t("Failed to add scanner"), "error");
    }
  }, [selectedUser, validateScope, addScope, addScanner, numericId, toast, t]);

  const submitInvite = useCallback(async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      toast(t("Enter a valid email address"), "error");
      return;
    }
    if (!validateScope(inviteScope)) return;
    try {
      const result = await inviteScanner({
        event: numericId,
        email,
        ...inviteScope,
      }).unwrap();
      setInviteResult({ email, inviteSent: result.invite_sent === true });
    } catch {
      toast(t("Failed to send invitation"), "error");
    }
  }, [
    inviteEmail,
    validateScope,
    inviteScope,
    inviteScanner,
    numericId,
    toast,
    t,
  ]);

  const submitEditScope = useCallback(async () => {
    if (!editingScanner) return;
    if (!validateScope(editScope)) return;
    try {
      await updateScope({
        scannerId: editingScanner.id,
        scope: editScope,
      }).unwrap();
      toast(t("Scanner scope updated"), "success");
      setEditingScanner(null);
    } catch {
      toast(t("Failed to update scanner scope"), "error");
    }
  }, [editingScanner, validateScope, editScope, updateScope, toast, t]);

  const confirmRemove = useCallback(
    async (scanner: EventScanner) => {
      setRemovingId(scanner.id);
      try {
        await removeScanner(scanner.id).unwrap();
        toast(
          `${scannerUserLabel(scanner.user_details)} ${t("removed")}`,
          "success",
        );
      } catch {
        toast(t("Failed to remove scanner"), "error");
      } finally {
        setRemovingId(null);
      }
    },
    [removeScanner, toast, t],
  );

  const onRemove = useCallback(
    (scanner: EventScanner) => {
      haptics.medium();
      Alert.alert(
        t("Remove scanner"),
        t("Are you sure you want to remove this scanner?"),
        [
          { text: t("Cancel"), style: "cancel" },
          {
            text: t("Remove"),
            style: "destructive",
            onPress: () => {
              void confirmRemove(scanner);
            },
          },
        ],
      );
    },
    [t, confirmRemove],
  );

  const scannerList = scanners ?? [];
  const results = searchResults ?? [];
  const activeTicketTypes = ticketTypes ?? [];

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t("Ticket Scanners")}
        onBack={() => navigate.back()}
        right={
          canManageScanners && !isCancelled ? (
            <PressableScale
              onPress={openAdd}
              accessibilityLabel={t("Add Scanner")}
              className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <UserPlus size={18} color={headerIconTint} />
            </PressableScale>
          ) : null
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: padding.top,
          paddingBottom: padding.bottom,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              if (!skipScanners) void refetch();
            }}
            tintColor={colors.muted}
          />
        }
      >
        <View className="gap-4">
          <View className="gap-1">
            {event?.title ? (
              <AppText
                numberOfLines={2}
                className="font-gilroy-semibold text-[16px]"
              >
                {event.title}
              </AppText>
            ) : null}
            <AppText className="font-gilroy-medium text-[14px] text-muted">
              {t("Manage who can scan tickets at your event")}
            </AppText>
          </View>

          {isCancelled ? (
            <EmptyState
              icon={ScanLine}
              title={t("Event cancelled, no event scanners.")}
            />
          ) : eventLoading || isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-3 w-32" />
              <View
                className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface"
                style={{ borderColor: cardBorder }}
              >
                {[0, 1, 2].map((key) => (
                  <View
                    key={key}
                    className={key > 0 ? "border-t" : ""}
                    style={key > 0 ? { borderColor: rowDivider } : undefined}
                  >
                    <ScannerRowSkeleton />
                  </View>
                ))}
              </View>
            </View>
          ) : isError ? (
            <EmptyState
              icon={ScanLine}
              title={t("Failed to load scanners")}
              actionLabel={t("Try again")}
              onAction={() => {
                void refetch();
              }}
            />
          ) : scannerList.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={t("No scanners assigned")}
              message={t("Add users who can scan tickets at your event")}
              actionLabel={canManageScanners ? t("Add Scanner") : undefined}
              onAction={canManageScanners ? openAdd : undefined}
            />
          ) : (
            <View className="gap-2">
              <AppText className="font-gilroy-semibold text-[13px] uppercase tracking-wide text-muted">
                {`${scannerList.length} ${scannerList.length === 1 ? t("Scanner") : t("Scanners")}`}
              </AppText>
              <View
                className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface"
                style={{ borderColor: cardBorder }}
              >
                {scannerList.map((scanner, index) => (
                  <View
                    key={scanner.id}
                    className={index > 0 ? "border-t" : ""}
                    style={index > 0 ? { borderColor: rowDivider } : undefined}
                  >
                    <ScannerRow
                      scanner={scanner}
                      canManage={canManageScanners}
                      removing={removingId === scanner.id}
                      onEditScope={() => openEditScope(scanner)}
                      onRemove={() => onRemove(scanner)}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <SheetModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("Add Scanner")}
      >
        <ScrollView
          style={{ maxHeight: 560 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-4">
            <View className="gap-2">
              <GlassInput
                placeholder={t("Search users by name or email...")}
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<Search size={18} color={colors.muted} />}
                rightIcon={
                  searching ? (
                    <ActivityIndicator size="small" color={colors.muted} />
                  ) : undefined
                }
              />
              {results.length > 0 ? (
                <View
                  className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface"
                  style={{ borderColor: cardBorder }}
                >
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
                        accessibilityLabel={availableUserLabel(user)}
                        className={cn(
                          "flex-row items-center gap-3 py-3",
                          index > 0 && "border-t",
                        )}
                        style={
                          index > 0 ? { borderColor: rowDivider } : undefined
                        }
                      >
                        <ScannerAvatar user={user} size={36} />
                        <View className="flex-1">
                          <AppText
                            numberOfLines={1}
                            className="font-gilroy-semibold text-[14px]"
                          >
                            {availableUserLabel(user)}
                          </AppText>
                          {user.email ? (
                            <AppText
                              numberOfLines={1}
                              className="font-gilroy-medium text-[12px] text-muted"
                            >
                              {user.email}
                            </AppText>
                          ) : null}
                        </View>
                        {active ? (
                          <Check size={18} color={ACCENT_GREEN} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {search.length >= 2 && !searching && results.length === 0 ? (
                <AppText className="py-2 text-center font-gilroy-medium text-[13px] text-muted">
                  {t("No users found")}
                </AppText>
              ) : null}
            </View>

            <ScopePicker
              value={addScope}
              onChange={setAddScope}
              ticketTypes={activeTicketTypes}
            />

            <PressableScale
              onPress={openInvite}
              accessibilityLabel={t("Invite by email")}
              className="h-11 flex-row items-center justify-center gap-2 rounded-[12px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <Mail size={16} color={headerIconTint} />
              <AppText className="font-gilroy-semibold text-[14px]">
                {t("Invite by email")}
              </AppText>
            </PressableScale>
          </View>
        </ScrollView>
        <SheetSubmitButton
          label={t("Add Scanner")}
          icon={UserPlus}
          onPress={() => {
            void submitAdd();
          }}
          disabled={!selectedUser}
          loading={adding}
        />
      </SheetModal>

      <SheetModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t("Invite by email")}
      >
        {inviteResult ? (
          <View className="items-center gap-3 py-4">
            <View
              className="h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ACCENT_GREEN}22` }}
            >
              <MailCheck size={28} color={ACCENT_GREEN} />
            </View>
            <AppText className="text-center font-gilroy-bold text-[18px]">
              {inviteResult.inviteSent
                ? t("Invitation sent")
                : t("Scanner added")}
            </AppText>
            <AppText className="text-center font-gilroy-medium text-[14px] text-muted">
              {inviteResult.inviteSent
                ? `${t("Invitation sent to")} ${inviteResult.email}`
                : `${inviteResult.email} ${t("added as scanner")}`}
            </AppText>
            <SheetSubmitButton
              label={t("Done")}
              icon={Check}
              onPress={() => setInviteOpen(false)}
              disabled={false}
              loading={false}
            />
          </View>
        ) : (
          <>
            <ScrollView
              style={{ maxHeight: 560 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View className="gap-4">
                <GlassInput
                  placeholder={t("Email")}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  leftIcon={<Mail size={18} color={colors.muted} />}
                />
                <ScopePicker
                  value={inviteScope}
                  onChange={setInviteScope}
                  ticketTypes={activeTicketTypes}
                />
              </View>
            </ScrollView>
            <SheetSubmitButton
              label={t("Send invitation")}
              icon={Mail}
              onPress={() => {
                void submitInvite();
              }}
              disabled={!inviteEmail.trim()}
              loading={inviting}
            />
          </>
        )}
      </SheetModal>

      <SheetModal
        visible={editingScanner != null}
        onClose={() => setEditingScanner(null)}
        title={t("Edit scanner scope")}
      >
        {editingScanner ? (
          <>
            <ScrollView
              style={{ maxHeight: 560 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-4">
                <View
                  className="flex-row items-center gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                  style={{ borderColor: cardBorder }}
                >
                  <ScannerAvatar user={editingScanner.user_details} size={40} />
                  <View className="flex-1">
                    <AppText
                      numberOfLines={1}
                      className="font-gilroy-semibold text-[14px]"
                    >
                      {scannerUserLabel(editingScanner.user_details)}
                    </AppText>
                    {editingScanner.user_details.email ? (
                      <AppText
                        numberOfLines={1}
                        className="font-gilroy-medium text-[12px] text-muted"
                      >
                        {editingScanner.user_details.email}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <ScopePicker
                  value={editScope}
                  onChange={setEditScope}
                  ticketTypes={activeTicketTypes}
                />
              </View>
            </ScrollView>
            <SheetSubmitButton
              label={t("Save")}
              icon={Check}
              onPress={() => {
                void submitEditScope();
              }}
              disabled={false}
              loading={savingScope}
            />
          </>
        ) : null}
      </SheetModal>
    </Screen>
  );
}
