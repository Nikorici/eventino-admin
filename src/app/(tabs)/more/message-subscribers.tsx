import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarDays, Check, ChevronDown, Clock, Info, Mail, Tag, Ticket, Users, X } from 'lucide-react-native';

import { dateFnsLocale, parseEventDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useAppSelector } from '@/store/hooks';
import {
  eventStartAt,
  useGetMessagingAudienceQuery,
  useGetTicketHoldersQuery,
  type ScheduledEmail,
} from '@/store/api/messageSubscribersApi';
import { AppText, EmptyState, GlassHeader, PressableScale, Screen, SegmentedControl } from '@/components/ui';
import { SearchBar } from '@/components/shared/SearchBar';
import { OptionSheet } from '@/components/dashboard/OptionSheet';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import {
  AudienceRowSkeleton,
  CategoryRow,
  EventRow,
  FollowerRow,
  TicketHolderRow,
} from '@/components/messaging/AudienceRows';
import {
  ComposeEmailSheet,
  type ComposeAudience,
  type ScheduleableEvent,
  type SendMode,
} from '@/components/messaging/ComposeEmailSheet';
import { ScheduledEmailsSheet } from '@/components/messaging/ScheduledEmailsSheet';

type TargetMode = 'followers' | 'events' | 'categories' | 'ticket_types';

interface ComposeTarget {
  editing: ScheduledEmail | null;
  sendMode: SendMode;
}

function toggleId<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function ListCard({ children }: { children: ReactNode[] }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  return (
    <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      {children.map((child, index) => (
        <View key={index} className={index > 0 ? 'border-t' : ''} style={index > 0 ? { borderColor: rowDivider } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

function SelectAllBar({
  allSelected,
  onToggle,
  summary,
  summaryCheck,
}: {
  allSelected: boolean;
  onToggle: () => void;
  summary: string | null;
  summaryCheck?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between">
      <PressableScale onPress={onToggle} accessibilityLabel={allSelected ? t('Unselect All') : t('Select All')}>
        <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-links dark:text-links">{allSelected ? t('Unselect All') : t('Select All')}</AppText>
      </PressableScale>
      {summary ? (
        <View className="flex-row items-center gap-1">
          {summaryCheck ? <Check size={14} color={colors.muted} /> : null}
          <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-muted dark:text-dark-muted">{summary}</AppText>
        </View>
      ) : null}
    </View>
  );
}

export default function MessageSubscribersScreen() {
  const { t, i18n } = useTranslation();
  const padding = useScreenPadding();
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const headerIcon = useThemeColor(colors.primary, colors.dark.text);
  const composeTint = useThemeColor(colors.white, colors.primary);
  const spinnerColor = useThemeColor('#2b3a44', '#f9f9f9');

  const [mode, setMode] = useState<TargetMode>('followers');
  const [search, setSearch] = useState('');
  const [selectedFollowerIds, setSelectedFollowerIds] = useState<number[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [ticketEventId, setTicketEventId] = useState<number | null>(null);
  const [selectedTicketTypeIds, setSelectedTicketTypeIds] = useState<number[]>([]);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [composeTarget, setComposeTarget] = useState<ComposeTarget | null>(null);
  const [scheduledOpen, setScheduledOpen] = useState(false);

  const audienceQuery = useGetMessagingAudienceQuery(userId ?? 0, { skip: userId == null });
  const ticketHoldersQuery = useGetTicketHoldersQuery(ticketEventId ?? 0, { skip: ticketEventId == null });
  const { data: audience, isLoading, isFetching, isError, refetch } = audienceQuery;

  const followers = useMemo(() => audience?.followers ?? [], [audience]);
  const events = useMemo(() => audience?.events ?? [], [audience]);
  const categories = useMemo(() => audience?.categories ?? [], [audience]);
  const ticketTypes = useMemo(() => ticketHoldersQuery.data?.ticket_types ?? [], [ticketHoldersQuery.data]);

  const filteredFollowers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return followers;
    return followers.filter(
      (follower) => follower.name.toLowerCase().includes(query) || (follower.email ?? '').toLowerCase().includes(query),
    );
  }, [followers, search]);

  const recipientIds = useMemo(() => {
    const ids = new Set<number>(selectedFollowerIds);
    const selectedCategoryNames = categories.filter((category) => selectedCategoryIds.includes(category.id)).map((category) => category.name);
    for (const event of events) {
      const picked = selectedEventIds.includes(event.id) || event.categories.some((name) => selectedCategoryNames.includes(name));
      if (picked) for (const attendeeId of event.attendeeIds) ids.add(attendeeId);
    }
    return Array.from(ids);
  }, [selectedFollowerIds, selectedEventIds, selectedCategoryIds, events, categories]);

  const applyFilters = useCallback(
    (eventIds: number[], categoryIds: string[]) => {
      setSelectedEventIds(eventIds);
      setSelectedCategoryIds(categoryIds);
      setSelectedFollowerIds(
        eventIds.length > 0 || categoryIds.length > 0
          ? followers.filter((follower) => follower.eventIds.some((id) => eventIds.includes(id))).map((follower) => follower.id)
          : [],
      );
    },
    [followers],
  );

  const activeFilters = useMemo(() => {
    const chips: { id: string; label: string; kind: 'event' | 'category'; remove: () => void }[] = [];
    for (const eventId of selectedEventIds) {
      const event = events.find((item) => item.id === eventId);
      if (event) {
        chips.push({
          id: `event-${eventId}`,
          label: event.title,
          kind: 'event',
          remove: () => applyFilters(selectedEventIds.filter((id) => id !== eventId), selectedCategoryIds),
        });
      }
    }
    for (const categoryId of selectedCategoryIds) {
      const category = categories.find((item) => item.id === categoryId);
      if (category) {
        chips.push({
          id: `category-${categoryId}`,
          label: category.name,
          kind: 'category',
          remove: () => applyFilters(selectedEventIds, selectedCategoryIds.filter((id) => id !== categoryId)),
        });
      }
    }
    return chips;
  }, [selectedEventIds, selectedCategoryIds, events, categories, applyFilters]);

  const scheduleableEvents = useMemo<ScheduleableEvent[]>(() => {
    const now = new Date();
    return events
      .map((event) => ({ id: event.id, name: event.title, startAt: eventStartAt(event) }))
      .filter((event): event is ScheduleableEvent => event.startAt !== null && event.startAt > now)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [events]);

  const selectedTicketTypes = ticketTypes.filter((ticketType) => selectedTicketTypeIds.includes(ticketType.id));
  const ticketHolderCount = selectedTicketTypes.reduce((sum, ticketType) => sum + ticketType.holder_count, 0);
  const isTicketAudience = mode === 'ticket_types';
  const composeCount = isTicketAudience ? ticketHolderCount : recipientIds.length;
  const showComposeBar = isTicketAudience ? selectedTicketTypeIds.length > 0 : recipientIds.length > 0;
  const ticketEvent = events.find((event) => event.id === ticketEventId) ?? null;

  const allFollowersSelected = filteredFollowers.length > 0 && selectedFollowerIds.length === filteredFollowers.length;
  const allTicketTypesSelected = ticketTypes.length > 0 && selectedTicketTypeIds.length === ticketTypes.length;

  const composeAudience: ComposeAudience = isTicketAudience
    ? {
        kind: 'ticketTypes',
        eventId: ticketEventId,
        ticketTypeIds: selectedTicketTypeIds,
        ticketTypeNames: selectedTicketTypes.map((ticketType) => ticketType.name),
        recipientCount: ticketHolderCount,
      }
    : { kind: 'followers', recipients: recipientIds, filterLabels: activeFilters.map((filter) => filter.label) };

  const eventDateLabel = useCallback(
    (startDate: string | null) => {
      const parsed = parseEventDate(startDate);
      return parsed ? format(parsed, 'd MMM yyyy', { locale: dateFnsLocale(i18n.language) }) : '';
    },
    [i18n.language],
  );

  const selectTicketEvent = (value: string) => {
    const nextId = value ? Number(value) : null;
    setTicketEventId(nextId === ticketEventId ? null : nextId);
    setSelectedTicketTypeIds([]);
  };

  const onRefresh = () => {
    void refetch();
    if (ticketEventId != null) void ticketHoldersQuery.refetch();
  };

  const renderFollowers = () => {
    if (filteredFollowers.length === 0) {
      const searching = search.trim().length > 0;
      const filtered = activeFilters.length > 0;
      return (
        <View className="gap-2">
          <EmptyState
            icon={Users}
            title={t('No results found')}
            message={
              searching
                ? t('No results match your search')
                : filtered
                  ? t('No subscribers match your current filters')
                  : t('No subscribers found')
            }
            actionLabel={searching ? t('Clear Search') : filtered ? t('Clear Filters') : undefined}
            onAction={searching ? () => setSearch('') : filtered ? () => applyFilters([], []) : undefined}
          />
          {!searching && !filtered ? (
            <View className="flex-row items-center justify-center gap-1.5 px-6">
              <Info size={14} color={colors.muted} />
              <AppText className="text-center font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
                {t('Try selecting events or categories to find subscribers')}
              </AppText>
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <View className="gap-3">
        <SelectAllBar
          allSelected={allFollowersSelected}
          onToggle={() => {
            haptics.selection();
            setSelectedFollowerIds(allFollowersSelected ? [] : filteredFollowers.map((follower) => follower.id));
          }}
          summary={selectedFollowerIds.length > 0 ? `${selectedFollowerIds.length} ${t('selected')}` : null}
        />
        <ListCard>
          {filteredFollowers.map((follower) => (
            <FollowerRow
              key={follower.id}
              follower={follower}
              selected={selectedFollowerIds.includes(follower.id)}
              onToggle={() => setSelectedFollowerIds((previous) => toggleId(previous, follower.id))}
            />
          ))}
        </ListCard>
      </View>
    );
  };

  const renderTicketTypes = () => (
    <View className="gap-4">
      <View className="gap-1.5">
        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{t('Select Event')}</AppText>
        <PressableScale
          onPress={() => setEventPickerOpen(true)}
          accessibilityLabel={`${t('Select Event')}: ${ticketEvent?.title ?? t('Choose an event...')}`}
          className="h-12 flex-row items-center justify-between gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface"
        >
          <AppText numberOfLines={1} className={ticketEvent ? 'flex-1 text-[16px] leading-[21px]' : 'flex-1 text-[16px] leading-[21px] text-muted dark:text-dark-muted'}>
            {ticketEvent?.title ?? t('Choose an event...')}
          </AppText>
          <ChevronDown size={18} color={colors.muted} />
        </PressableScale>
      </View>

      {ticketEventId == null ? (
        <EmptyState icon={Ticket} title={t('Select an event')} message={t('Choose an event above to see its ticket types')} />
      ) : ticketHoldersQuery.isFetching && !ticketHoldersQuery.data ? (
        <View className="gap-2">
          <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('Loading ticket types...')}</AppText>
          <ListCard>
            {[0, 1, 2].map((key) => (
              <AudienceRowSkeleton key={key} />
            ))}
          </ListCard>
        </View>
      ) : ticketHoldersQuery.isError ? (
        <EmptyState
          icon={Ticket}
          title={t('Something went wrong')}
          actionLabel={t('Try again')}
          onAction={() => {
            void ticketHoldersQuery.refetch();
          }}
        />
      ) : ticketTypes.length === 0 ? (
        <EmptyState icon={Ticket} title={t('No ticket types found')} message={t('This event has no paid ticket holders')} />
      ) : (
        <View className="gap-3">
          <SelectAllBar
            allSelected={allTicketTypesSelected}
            onToggle={() => {
              haptics.selection();
              setSelectedTicketTypeIds(allTicketTypesSelected ? [] : ticketTypes.map((ticketType) => ticketType.id));
            }}
            summary={selectedTicketTypeIds.length > 0 ? `${ticketHolderCount} ${t('recipients')}` : null}
            summaryCheck
          />
          <ListCard>
            {ticketTypes.map((ticketType) => (
              <TicketHolderRow
                key={ticketType.id}
                ticketType={ticketType}
                selected={selectedTicketTypeIds.includes(ticketType.id)}
                onToggle={() => setSelectedTicketTypeIds((previous) => toggleId(previous, ticketType.id))}
              />
            ))}
          </ListCard>
        </View>
      )}
    </View>
  );

  const renderList = () => {
    if (isLoading || userId == null) {
      return (
        <ListCard>
          {[0, 1, 2, 3, 4].map((key) => (
            <AudienceRowSkeleton key={key} />
          ))}
        </ListCard>
      );
    }
    if (isError) {
      return (
        <EmptyState
          icon={Users}
          title={t('Something went wrong')}
          actionLabel={t('Try again')}
          onAction={() => {
            void refetch();
          }}
        />
      );
    }
    if (mode === 'ticket_types') return renderTicketTypes();
    if (mode === 'events') {
      if (events.length === 0) {
        return <EmptyState icon={CalendarDays} title={t('No events found')} message={t("You haven't created any events yet")} />;
      }
      return (
        <ListCard>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              selected={selectedEventIds.includes(event.id)}
              dateLabel={eventDateLabel(event.startDate)}
              onToggle={() => applyFilters(toggleId(selectedEventIds, event.id), selectedCategoryIds)}
            />
          ))}
        </ListCard>
      );
    }
    if (mode === 'categories') {
      if (categories.length === 0) {
        return <EmptyState icon={Tag} title={t('No categories found')} message={t('Create events to generate categories')} />;
      }
      return (
        <ListCard>
          {categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              selected={selectedCategoryIds.includes(category.id)}
              onToggle={() => applyFilters(selectedEventIds, toggleId(selectedCategoryIds, category.id))}
            />
          ))}
        </ListCard>
      );
    }
    return renderFollowers();
  };

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Message Subscribers')}
        onBack={navigate.back}
        right={
          <PressableScale
            onPress={() => {
              haptics.light();
              setScheduledOpen(true);
            }}
            accessibilityLabel={t('Scheduled Emails')}
            className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
          >
            <Clock size={18} color={headerIcon} />
          </PressableScale>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingTop: padding.top,
          paddingBottom: padding.bottom + (showComposeBar ? 76 : 0),
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
            {t('Choose who receives your email, then compose or schedule it.')}
          </AppText>

          <SegmentedControl<TargetMode>
            compact
            value={mode}
            onChange={setMode}
            options={[
              { value: 'followers', label: t('Followers') },
              { value: 'events', label: t('Events') },
              { value: 'categories', label: t('Categories') },
              { value: 'ticket_types', label: t('Ticket Types') },
            ]}
          />

          {mode === 'followers' ? (
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('Search by name or email...')} />
          ) : null}

          {activeFilters.length > 0 && mode !== 'ticket_types' ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('Active Filters')}</AppText>
                <PressableScale onPress={() => applyFilters([], [])} accessibilityLabel={t('Clear All')}>
                  <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-links dark:text-links">{t('Clear All')}</AppText>
                </PressableScale>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <PressableScale
                    key={filter.id}
                    onPress={() => {
                      haptics.selection();
                      filter.remove();
                    }}
                    accessibilityLabel={`${t('Remove')} ${filter.label}`}
                    className="h-8 flex-row items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-white/10"
                  >
                    {filter.kind === 'event' ? <CalendarDays size={12} color={colors.muted} /> : <Tag size={12} color={colors.muted} />}
                    <AppText numberOfLines={1} className="max-w-[160px] font-gilroy-medium text-[13px] leading-[17px]">
                      {filter.label}
                    </AppText>
                    <X size={13} color={colors.muted} />
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          {renderList()}
        </View>
      </ScrollView>

      {showComposeBar ? (
        <View
          style={{ paddingBottom: padding.bottom - 12 }}
          className="absolute bottom-0 left-0 right-0 border-t border-app-border bg-app-bg px-4 pt-3 dark:border-dark-border dark:bg-dark-bg"
        >
          <PressableScale
            onPress={() => {
              haptics.light();
              setComposeTarget({ editing: null, sendMode: 'now' });
            }}
            accessibilityLabel={t('Compose email')}
            className="h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white"
          >
            <Mail size={18} color={composeTint} />
            <AppText className="font-gilroy-bold text-[16px] leading-[21px] text-white dark:text-primary">
              {`${t('Compose email')} · ${t('{{count}} recipients', { count: composeCount })}`}
            </AppText>
          </PressableScale>
        </View>
      ) : null}

      {eventPickerOpen ? (
        <OptionSheet
          title={t('Select Event')}
          value={ticketEventId == null ? '' : String(ticketEventId)}
          options={[
            { value: '', label: t('Choose an event...') },
            ...events.map((event) => ({ value: String(event.id), label: event.title })),
          ]}
          onSelect={selectTicketEvent}
          onClose={() => setEventPickerOpen(false)}
        />
      ) : null}

      {composeTarget ? (
        <ComposeEmailSheet
          audience={composeTarget.editing ? { kind: 'followers', recipients: composeTarget.editing.recipients, filterLabels: [] } : composeAudience}
          editing={composeTarget.editing}
          scheduleableEvents={scheduleableEvents}
          initialSendMode={composeTarget.sendMode}
          defaultScheduleEventId={selectedEventIds.length === 1 ? selectedEventIds[0] : null}
          onClose={() => setComposeTarget(null)}
        />
      ) : null}

      {scheduledOpen ? (
        <ScheduledEmailsSheet
          onClose={() => setScheduledOpen(false)}
          onEdit={(email) => {
            setScheduledOpen(false);
            setComposeTarget({ editing: email, sendMode: 'schedule' });
          }}
          onScheduleNew={() => {
            setScheduledOpen(false);
            setComposeTarget({ editing: null, sendMode: 'schedule' });
          }}
        />
      ) : null}
    </Screen>
  );
}
