import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Check, UserPen } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, PressableScale, Screen, Skeleton } from '@/components/ui';
import { matchesQuery, PanelCard, RowDivider, SearchField } from '@/components/dashboard/dashboardParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetEventTicketsQuery, useSetTicketDisplayNameMutation, type EventTicketRecord } from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

const SAVED_GREEN = '#0f9f5f';
const SCANNED_GREEN = '#34c759';

function TicketNameRow({
  ticket,
  value,
  saving,
  saved,
  locked,
  onChange,
  onSave,
}: {
  ticket: EventTicketRecord;
  value: string;
  saving: boolean;
  saved: boolean;
  locked: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const dirty = value !== (ticket.display_name ?? '');
  const spinner = useThemeColor(colors.white, colors.primary);
  return (
    <View className="gap-2 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
            {ticket.ticket_type} · #{ticket.id}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">
            {ticket.account_name || t('Unknown')}
          </AppText>
        </View>
        <AppText
          className="font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted leading-[16px]"
          style={ticket.scan_date ? { color: SCANNED_GREEN } : undefined}
        >
          {`${t('Scanned')}: ${ticket.scan_date ? t('Yes') : t('No')}`}
        </AppText>
        {saved && !dirty ? <Check size={16} color={SAVED_GREEN} /> : null}
      </View>
      <View className="flex-row items-center gap-2">
        <View
          className={cn(
            'h-12 flex-1 flex-row items-center rounded-[10px] border bg-app-surface px-3 dark:bg-dark-surface',
            dirty ? 'border-primary dark:border-dark-text' : 'border-app-border dark:border-dark-border',
          )}
        >
          <TextInput
            placeholder={ticket.account_name || t('Name on ticket')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('Name on ticket')}
            value={value}
            onChangeText={onChange}
            editable={!locked}
            autoCapitalize="words"
            style={{ includeFontPadding: false }}
            className="h-full flex-1 font-gilroy text-[16px] text-primary dark:text-dark-text"
          />
        </View>
        {locked ? null : (
          <PressableScale
            onPress={onSave}
            disabled={saving || !dirty}
            accessibilityLabel={t('Save')}
            className={cn(
              'h-12 items-center justify-center rounded-[10px] bg-primary px-4 dark:bg-white',
              (!dirty || saving) && 'opacity-50',
            )}
          >
            {saving ? (
              <ActivityIndicator size="small" color={spinner} />
            ) : (
              <AppText className="font-gilroy-semibold text-[14px] text-white dark:text-primary leading-[19px]">{t('Save')}</AppText>
            )}
          </PressableScale>
        )}
      </View>
    </View>
  );
}

export default function TicketNamesScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const cancelled = Boolean(event?.is_cancelled);

  const ticketsQuery = useGetEventTicketsQuery(eventId ?? 0, { skip: eventId == null || !event || cancelled });
  const [setDisplayName] = useSetTicketDisplayNameMutation();
  const [values, setValues] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const tickets = useMemo(() => (cancelled ? [] : (ticketsQuery.data ?? [])), [cancelled, ticketsQuery.data]);
  const valueOf = (ticket: EventTicketRecord) => values[ticket.id] ?? ticket.display_name ?? '';

  const visible = useMemo(
    () =>
      tickets.filter((ticket) =>
        matchesQuery(query, [ticket.account_name, ticket.ticket_type, ticket.display_name, ticket.id]),
      ),
    [tickets, query],
  );

  const save = async (ticket: EventTicketRecord) => {
    if (eventId == null) return;
    haptics.selection();
    setSavingId(ticket.id);
    try {
      await setDisplayName({ eventId, ticketId: ticket.id, displayName: valueOf(ticket) }).unwrap();
      haptics.success();
      setSavedIds((previous) => new Set(previous).add(ticket.id));
    } catch (error) {
      haptics.error();
      toast(extractApiError(error) ?? t('Update failed'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), cancelled ? undefined : ticketsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderList = () => {
    if (eventLoading || ticketsQuery.isLoading) {
      return (
        <View className="gap-2">
          <Skeleton className="h-24 w-full rounded-[12px]" />
          <Skeleton className="h-24 w-full rounded-[12px]" />
          <Skeleton className="h-24 w-full rounded-[12px]" />
        </View>
      );
    }
    if (eventError || !event) {
      return (
        <EmptyState
          icon={UserPen}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (ticketsQuery.isError) {
      return (
        <EmptyState
          icon={UserPen}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void ticketsQuery.refetch()}
        />
      );
    }
    if (visible.length === 0) {
      return (
        <EmptyState icon={UserPen} title={query.trim() ? t('No results match your search') : t('No paid tickets yet.')} />
      );
    }
    return (
      <PanelCard>
        {visible.map((ticket, index) => (
          <RowDivider key={ticket.id} index={index}>
            <TicketNameRow
              ticket={ticket}
              value={valueOf(ticket)}
              saving={savingId === ticket.id}
              saved={savedIds.has(ticket.id)}
              locked={cancelled}
              onChange={(next) => setValues((previous) => ({ ...previous, [ticket.id]: next }))}
              onSave={() => void save(ticket)}
            />
          </RowDivider>
        ))}
      </PanelCard>
    );
  };

  return (
    <Screen edges={[]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-3">
          <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted leading-[19px]">
            {t('Set the name printed on each paid ticket. Buyers see it on their QR code.')}
          </AppText>
          <SearchField value={query} onChange={setQuery} placeholder={t('Search by account, ticket type, attendee...')} />
          {renderList()}
        </View>
      </KeyboardAwareScrollView>
      <GlassHeader title={t('Ticket names')} onBack={navigate.back} />
    </Screen>
  );
}
