import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Plus, Ticket, UserPen } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, PressableScale, Screen, SegmentedControl } from '@/components/ui';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import { TicketTypeCard, TicketTypeCardSkeleton } from '@/components/ticket-types/TicketTypeCard';
import { TicketTypeSheet } from '@/components/ticket-types/TicketTypeSheet';
import { useScrollInsets } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { WEB_ORIGIN } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { eventDaysBetween } from '@/lib/ticketDays';
import {
  useDeleteManageTicketTypeMutation,
  useGetManageTicketTypesQuery,
  useUpdateManageTicketTypeMutation,
  type ManageTicketType,
} from '@/store/api/ticketTypesApi';
import { colors } from '@/theme/colors';

type StatusFilter = 'all' | 'active' | 'inactive';

const keyExtractor = (item: ManageTicketType) => String(item.id);

const ItemSeparator = () => <View className="h-2.5" />;

export default function TicketTypesScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const scroll = useScrollInsets();
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();

  const ticketTypesQuery = useGetManageTicketTypesQuery(eventId ?? 0, { skip: eventId == null });
  const [updateTicketType] = useUpdateManageTicketTypeMutation();
  const [deleteTicketType] = useDeleteManageTicketTypeMutation();

  const [sheet, setSheet] = useState<{ editing: ManageTicketType | null } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pinnableDays = useMemo(
    () => eventDaysBetween(event?.start_date, event?.end_date),
    [event?.start_date, event?.end_date],
  );
  const currency = event?.currency ?? '';
  const ticketTypes = useMemo(() => ticketTypesQuery.data ?? [], [ticketTypesQuery.data]);
  const filtered = useMemo(() => {
    if (filter === 'active') return ticketTypes.filter((item) => item.is_active);
    if (filter === 'inactive') return ticketTypes.filter((item) => !item.is_active);
    return ticketTypes;
  }, [ticketTypes, filter]);

  const openCreate = useCallback(() => {
    haptics.light();
    setSheet({ editing: null });
  }, []);

  const onToggleActive = async (ticketType: ManageTicketType) => {
    if (eventId == null) return;
    haptics.selection();
    setTogglingId(ticketType.id);
    try {
      await updateTicketType({ ticketTypeId: ticketType.id, eventId, body: { is_active: !ticketType.is_active } }).unwrap();
      toast(ticketType.is_active ? t('Ticket type deactivated') : t('Ticket type activated'), 'success');
    } catch {
      toast(t('Could not update ticket type'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const performDelete = async (ticketType: ManageTicketType) => {
    if (eventId == null) return;
    setDeletingId(ticketType.id);
    try {
      await deleteTicketType({ ticketTypeId: ticketType.id, eventId }).unwrap();
      toast(t('Ticket type deleted'), 'success');
    } catch {
      toast(t('This ticket type has sold tickets. Deactivate it instead of deleting.'), 'info');
    } finally {
      setDeletingId(null);
    }
  };

  const onDelete = (ticketType: ManageTicketType) => {
    haptics.medium();
    if (ticketType.sold_count > 0) {
      toast(t('This ticket type has sold tickets. Deactivate it instead of deleting.'), 'info');
      return;
    }
    confirmAction({
      title: t('Delete this ticket type?'),
      message: ticketType.name,
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: () => void performDelete(ticketType),
    });
  };

  const onCopyEmbedLink = async (ticketType: ManageTicketType) => {
    await Clipboard.setStringAsync(`${WEB_ORIGIN}/${event?.slug || 'event'}/${eventId}/embed?ticket=${ticketType.id}`);
    haptics.success();
    toast(t('Live embed link copied'), 'success');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), ticketTypesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderEmpty = () => {
    if (eventLoading || ticketTypesQuery.isLoading) {
      return (
        <View className="gap-2.5">
          <TicketTypeCardSkeleton />
          <TicketTypeCardSkeleton />
          <TicketTypeCardSkeleton />
        </View>
      );
    }
    if (eventError || !event) {
      return (
        <EmptyState
          icon={Ticket}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (ticketTypesQuery.isError) {
      return (
        <EmptyState
          icon={Ticket}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void ticketTypesQuery.refetch()}
        />
      );
    }
    if (ticketTypes.length === 0) {
      return (
        <EmptyState icon={Ticket} title={t('No ticket types yet.')} actionLabel={t('Add ticket type')} onAction={openCreate} />
      );
    }
    return <EmptyState icon={Ticket} title={t('No ticket types match this filter.')} />;
  };

  const ready = event != null && !ticketTypesQuery.isError;

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Ticket types')}
        onBack={navigate.back}
        right={
          <PressableScale
            onPress={openCreate}
            disabled={!ready}
            accessibilityLabel={t('Add ticket type')}
            className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
          >
            <Plus size={18} color={headerIconTint} />
          </PressableScale>
        }
      />
      <FlashList
        data={ready ? filtered : []}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <TicketTypeCard
            ticketType={item}
            currency={currency}
            pinnableDays={pinnableDays}
            toggling={togglingId === item.id}
            deleting={deletingId === item.id}
            onToggleActive={() => void onToggleActive(item)}
            onEdit={() => setSheet({ editing: item })}
            onCopyEmbedLink={() => void onCopyEmbedLink(item)}
            onDelete={() => onDelete(item)}
          />
        )}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View className="gap-3 pb-4">
            <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted leading-[19px]">
              {t('Set how many tickets are available for each type.')}
            </AppText>
            <PressableScale
              onPress={() => {
                haptics.selection();
                navigate.ticketNames();
              }}
              accessibilityLabel={t('Ticket names')}
              className="h-11 flex-row items-center justify-center gap-2 rounded-[10px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <UserPen size={16} color={headerIconTint} />
              <AppText className="font-gilroy-semibold text-[13px] leading-[17px]">{t('Ticket names')}</AppText>
            </PressableScale>
            {ready && ticketTypes.length > 0 ? (
              <SegmentedControl<StatusFilter>
                options={[
                  { value: 'all', label: `${t('All')} (${ticketTypes.length})` },
                  { value: 'active', label: t('Active') },
                  { value: 'inactive', label: t('Inactive') },
                ]}
                value={filter}
                onChange={setFilter}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={renderEmpty()}
        {...scroll.scrollProps}
        contentContainerStyle={{ paddingTop: scroll.paddingTop, paddingBottom: scroll.paddingBottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={scroll.refreshOffset}
          />
        }
      />

      {sheet && eventId != null ? (
        <TicketTypeSheet
          eventId={eventId}
          currency={currency}
          pinnableDays={pinnableDays}
          editing={sheet.editing}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}
