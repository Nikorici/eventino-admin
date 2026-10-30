import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Download, Search, UserPlus, X } from 'lucide-react-native';

import { navigate } from '@/lib/nav';
import { haptics } from '@/lib/haptics';
import { getAccessToken } from '@/lib/storage';
import { downloadAuthedFile, shareFile } from '@/lib/downloads';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { usePresaleRealtime, type PresaleStreamStatus } from '@/hooks/usePresaleRealtime';
import { formatStamp, matchesFilter, mergeRegistrations, percentOf, refreshRegistrations, sourceLabel, sourceShares } from '@/lib/presale';
import {
  presaleEndpoints,
  useLazyGetPresaleOrganizerQuery,
  useLazyGetPresaleRegistrationsQuery,
  type PresaleOrganizerResponse,
  type PresaleRegistrationRow,
  type PresaleStreamMessage,
} from '@/store/api/presaleApi';
import { AppText, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';

type LoadState = 'loading' | 'ready' | 'denied' | 'error';

const SEARCH_DELAY_MS = 300;
const FRESH_ROW_MS = 2500;
const BAR_COLOR = '#4a4ebe';

const STATE_LABELS: Record<string, string> = {
  COMING_SOON: 'Coming soon',
  PRE_SALE_REGISTRATION: 'Registration open',
  PRE_SALE_LIVE: 'Pre-sale live',
  PUBLIC_SALE: 'Public sale',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const STREAM_LABELS: Record<PresaleStreamStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  paused: 'Paused',
};

const STREAM_COLORS: Record<PresaleStreamStatus, string> = {
  connecting: '#ff9500',
  live: '#34c759',
  reconnecting: '#ff9500',
  paused: '#8e8e93',
};

const STATUS_COLORS: Record<string, string> = {
  SENT: '#15803d',
  FAILED: '#b91c1c',
  SENDING: '#b45309',
};

const DETAIL_FIELDS: [keyof PresaleRegistrationRow, string][] = [
  ['utm_source', 'UTM source'],
  ['utm_medium', 'Medium'],
  ['utm_campaign', 'Campaign'],
  ['utm_content', 'Content'],
  ['utm_term', 'Term'],
  ['referrer', 'Referrer'],
  ['landing_url', 'Landing page'],
];

function errorStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return error.status;
  return null;
}

function PresaleSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-[116px] rounded-[12px]" />
      <View className="flex-row flex-wrap gap-2.5">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-[84px] grow basis-[46%] rounded-[12px]" />
        ))}
      </View>
      <Skeleton className="h-[220px] rounded-[12px]" />
      <Skeleton className="h-[140px] rounded-[12px]" />
    </View>
  );
}

export default function PresaleScreen() {
  const { eventId: selectedEventId, data: selectedEvent, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const hasPresale = Boolean(selectedEvent?.has_presale);
  const eventId = hasPresale && selectedEventId != null ? selectedEventId : null;
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const insets = useSafeAreaInsets();
  const padding = useScreenPadding();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const [fetchOverview] = useLazyGetPresaleOrganizerQuery();
  const [fetchPage] = useLazyGetPresaleRegistrationsQuery();
  const [overview, setOverview] = useState<PresaleOrganizerResponse | null>(null);
  const [rows, setRows] = useState<PresaleRegistrationRow[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<PresaleRegistrationRow | null>(null);
  const [freshIds, setFreshIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const filterRef = useRef({ q: '', source: '' });
  filterRef.current = { q: query, source };
  const rowsRef = useRef<PresaleRegistrationRow[]>([]);
  rowsRef.current = rows;
  const nextBeforeRef = useRef<number | null>(null);
  nextBeforeRef.current = nextBefore;
  const sequenceRef = useRef(0);
  const loadedRef = useRef(false);
  const overviewRef = useRef<PresaleOrganizerResponse | null>(null);
  const loadingMoreRef = useRef(false);
  const loadMoreFailedRef = useRef(false);

  const loadOverview = useCallback(async () => {
    if (eventId == null) return null;
    try {
      const payload = await fetchOverview(eventId).unwrap();
      loadedRef.current = true;
      if (overviewRef.current && payload.summary.total < overviewRef.current.summary.total) return null;
      overviewRef.current = payload;
      setOverview(payload);
      setLoadState('ready');
      return payload;
    } catch (error) {
      if (!loadedRef.current) setLoadState(errorStatus(error) === 403 ? 'denied' : 'error');
      return null;
    }
  }, [eventId, fetchOverview]);

  const loadFilteredRows = useCallback(
    async (sequence: number = ++sequenceRef.current) => {
      if (eventId == null) return;
      loadMoreFailedRef.current = false;
      try {
        const page = await fetchPage({ eventId, ...filterRef.current }).unwrap();
        if (sequence !== sequenceRef.current) return;
        setRows(page.registrations);
        setNextBefore(page.next_before);
      } catch {
        return;
      }
    },
    [eventId, fetchPage],
  );

  const resync = useCallback(
    async (options?: { merge?: boolean }) => {
      const sequence = ++sequenceRef.current;
      loadMoreFailedRef.current = false;
      const payload = await loadOverview();
      if (!payload || sequence !== sequenceRef.current) return;
      if (filterRef.current.q || filterRef.current.source) {
        await loadFilteredRows(sequence);
        return;
      }
      if (!options?.merge) {
        setRows(payload.registrations);
        setNextBefore(payload.next_before);
        return;
      }
      const refreshed = refreshRegistrations(rowsRef.current, nextBeforeRef.current, {
        registrations: payload.registrations,
        next_before: payload.next_before,
      });
      setRows(refreshed.rows);
      setNextBefore(refreshed.nextBefore);
    },
    [loadOverview, loadFilteredRows],
  );

  const resyncRef = useRef(resync);
  resyncRef.current = resync;
  const filteredRef = useRef(loadFilteredRows);
  filteredRef.current = loadFilteredRows;

  useEffect(() => {
    loadedRef.current = false;
    overviewRef.current = null;
    setOverview(null);
    setLoadState('loading');
    void resyncRef.current();
  }, [eventId]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const lastFilter = useRef('|');
  useEffect(() => {
    const key = `${query}|${source}`;
    if (key === lastFilter.current) return;
    lastFilter.current = key;
    if (query || source) {
      void filteredRef.current();
      return;
    }
    void resyncRef.current();
  }, [query, source]);

  const onMessage = useCallback((message: PresaleStreamMessage) => {
    if (message.type === 'notifications') {
      void resyncRef.current({ merge: true });
      return;
    }
    setOverview((prev) => {
      if (!prev || message.summary.total < prev.summary.total) return prev;
      const next = { ...prev, summary: message.summary };
      overviewRef.current = next;
      return next;
    });
    if (!matchesFilter(message.registration, filterRef.current)) return;
    const newId = message.registration.id;
    setRows((prev) => mergeRegistrations(prev, [message.registration]));
    setFreshIds((prev) => [...prev, newId]);
    setTimeout(() => setFreshIds((prev) => prev.filter((item) => item !== newId)), FRESH_ROW_MS);
  }, []);

  const onResync = useCallback(() => {
    void resyncRef.current({ merge: true });
  }, []);

  const streamStatus = usePresaleRealtime({
    eventId: eventId ?? undefined,
    enabled: loadState === 'ready',
    onMessage,
    onResync,
  });

  const firstLive = useRef(false);
  useEffect(() => {
    if (streamStatus !== 'live' || firstLive.current) return;
    firstLive.current = true;
    void resyncRef.current({ merge: true });
  }, [streamStatus]);

  const loadMore = useCallback(async () => {
    const before = nextBeforeRef.current;
    if (eventId == null || !before || loadingMoreRef.current || loadMoreFailedRef.current) return;
    loadingMoreRef.current = true;
    const sequence = sequenceRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage({ eventId, ...filterRef.current, before }).unwrap();
      if (sequence !== sequenceRef.current) return;
      setRows((prev) => mergeRegistrations(prev, page.registrations));
      setNextBefore(page.next_before);
    } catch {
      if (sequence === sequenceRef.current) {
        loadMoreFailedRef.current = true;
        toast(t('Please try again.'), 'error');
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [eventId, fetchPage, t, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await resyncRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onExport = useCallback(async () => {
    if (exporting || eventId == null) return;
    void haptics.selection();
    setExporting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast(t('You must be logged in for this action.'), 'error');
        return;
      }
      const uri = await downloadAuthedFile(presaleEndpoints.export(eventId), token, `presale-${eventId}.csv`);
      const shared = await shareFile(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: t('Export CSV') });
      if (!shared) await WebBrowser.openBrowserAsync(uri);
    } catch {
      toast(t('Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  }, [eventId, exporting, t, toast]);

  const retry = () => {
    if (eventError) {
      void refetchEvent();
      return;
    }
    setLoadState('loading');
    void resyncRef.current();
  };

  const eventPending = eventLoading || (!selectedEvent && !eventError);
  const showPlaceholder = eventPending || eventError || !hasPresale || loadState !== 'ready' || !overview;

  if (showPlaceholder) {
    const loading = eventPending || (hasPresale && loadState === 'loading');
    const message = eventError
      ? t('Unable to load event data.')
      : !hasPresale
        ? t('This event has no pre-sale.')
        : loadState === 'denied'
          ? t("You don't have access to the pre-sale of this event.")
          : t('Unable to load event data.');
    const canRetry = eventError || loadState === 'error';
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Pre-sale')} onBack={navigate.back} />
        {loading ? (
          <ScrollView contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}>
            <PresaleSkeleton />
          </ScrollView>
        ) : (
          <View className="flex-1 justify-center px-6" style={{ paddingTop: padding.top, paddingBottom: padding.bottom }}>
            <EmptyState
              icon={UserPlus}
              title={message}
              actionLabel={canRetry ? t('Try again') : undefined}
              onAction={canRetry ? retry : undefined}
            />
          </View>
        )}
      </Screen>
    );
  }

  const { presale, event, summary } = overview;
  const shares = sourceShares(summary);
  const sent = summary.notifications.SENT ?? 0;
  const filtered = Boolean(query || source);

  const header = (
    <View className="gap-3 pb-4">
      <View className="gap-2 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <View className="flex-row items-center justify-between gap-3">
          <AppText numberOfLines={2} className="flex-1 font-gilroy-bold text-[17px]">
            {event.title}
          </AppText>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: STREAM_COLORS[streamStatus] }} />
            <AppText className="font-gilroy-semibold text-[12px]" style={{ color: STREAM_COLORS[streamStatus] }}>
              {t(STREAM_LABELS[streamStatus])}
            </AppText>
          </View>
        </View>
        <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-white">
          {t(STATE_LABELS[presale.state] ?? presale.state)}
        </AppText>
        <AppText className="font-gilroy-medium text-[12px] text-muted">
          {t('Pre-sale opens')}: {presale.starts_at ? formatStamp(presale.starts_at, lang) : t('Date not set')}
        </AppText>
        <AppText className="font-gilroy-medium text-[12px] text-muted">
          {t('Public sale opens')}: {presale.public_sale_starts_at ? formatStamp(presale.public_sale_starts_at, lang) : t('Date not set')}
        </AppText>
      </View>

      <View className="flex-row flex-wrap gap-2.5">
        {[
          { label: t('Registrations'), value: String(summary.total), hint: '' },
          { label: t('Today'), value: String(summary.today), hint: '' },
          { label: t('New leads'), value: String(summary.new_leads), hint: t('No Eventino account yet') },
          {
            label: t('Eventino users'),
            value: String(summary.with_account),
            hint: `${percentOf(summary.with_account, summary.total)}% · ${t('Already have an Eventino account')}`,
          },
          { label: t('With phone'), value: String(summary.with_phone), hint: `${percentOf(summary.with_phone, summary.total)}%` },
          { label: t('Notified'), value: String(sent), hint: `${sent} / ${summary.total}` },
        ].map((kpi) => (
          <View
            key={kpi.label}
            className="grow basis-[46%] gap-1 rounded-[12px] border bg-white p-3.5 dark:bg-dark-surface"
            style={{ borderColor: cardBorder }}
          >
            <AppText className="font-gilroy-medium text-[12px] text-muted">{kpi.label}</AppText>
            <AppText className="font-gilroy-bold text-[24px]">{kpi.value}</AppText>
            {kpi.hint ? <AppText className="font-gilroy-medium text-[11px] text-muted">{kpi.hint}</AppText> : null}
          </View>
        ))}
      </View>

      <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <AppText className="font-gilroy-bold text-[15px]">{t('Traffic sources')}</AppText>
        {shares.length ? (
          shares.map((item) => (
            <PressableScale
              key={item.source}
              onPress={() => {
                void haptics.selection();
                setSource((prev) => (prev === item.source ? '' : item.source));
              }}
              accessibilityLabel={sourceLabel(item.source, t)}
              className={`gap-1.5 rounded-[10px] p-2 ${source === item.source ? 'bg-black/[0.05] dark:bg-white/10' : ''}`}
            >
              <View className="flex-row items-center justify-between">
                <AppText className="font-gilroy-semibold text-[14px]">{sourceLabel(item.source, t)}</AppText>
                <AppText className="font-gilroy-medium text-[13px] text-muted">
                  {item.count} · {item.percent}%
                </AppText>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                <View className="h-full rounded-full" style={{ width: `${item.percent}%`, backgroundColor: BAR_COLOR }} />
              </View>
            </PressableScale>
          ))
        ) : (
          <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No registrations yet')}</AppText>
        )}
      </View>

      <View className="gap-2 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <AppText className="font-gilroy-bold text-[15px]">{t('Top campaigns')}</AppText>
        {summary.campaigns.length ? (
          summary.campaigns.map((item) => (
            <View key={item.campaign} className="flex-row justify-between gap-3">
              <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[13px]">
                {item.campaign}
              </AppText>
              <AppText className="font-gilroy-bold text-[13px]">{item.count}</AppText>
            </View>
          ))
        ) : (
          <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No campaigns yet')}</AppText>
        )}
        <AppText className="mt-1 font-gilroy-bold text-[13px] text-muted">{t('Languages')}</AppText>
        <View className="flex-row gap-4">
          {summary.languages.map((item) => (
            <AppText key={item.language} className="font-gilroy-medium text-[13px] text-muted">
              {item.language.toUpperCase()} <AppText className="font-gilroy-bold text-[13px]">{item.count}</AppText>
            </AppText>
          ))}
        </View>
      </View>

      <AppText className="mt-1 font-gilroy-bold text-[18px]">{t('Registrations')}</AppText>
      <GlassInput
        placeholder={t('Search email or phone')}
        accessibilityLabel={t('Search email or phone')}
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        leftIcon={<Search size={18} color={colors.muted} />}
      />
      {source ? (
        <PressableScale
          onPress={() => {
            void haptics.selection();
            setSource('');
          }}
          accessibilityLabel={t('Clear filter')}
          className="h-8 flex-row items-center gap-1.5 self-start rounded-full bg-black/[0.06] px-3 dark:bg-white/10"
        >
          <AppText className="font-gilroy-semibold text-[13px]">{sourceLabel(source, t)}</AppText>
          <X size={14} color={iconTint} />
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Pre-sale')}
        onBack={navigate.back}
        right={
          <PressableScale
            onPress={() => void onExport()}
            disabled={exporting}
            accessibilityLabel={t('Export CSV')}
            className="h-9 w-9 items-center justify-center rounded-full border bg-white dark:bg-dark-surface"
            style={{ borderColor: cardBorder }}
          >
            {exporting ? <ActivityIndicator /> : <Download size={18} color={iconTint} />}
          </PressableScale>
        }
      />
      <FlashList
        data={rows}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void haptics.selection();
              setSelected(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={item.email}
            className={`gap-1 rounded-[12px] border p-3.5 ${freshIds.includes(item.id) ? 'bg-[#eaf7ef] dark:bg-[#12301f]' : 'bg-white dark:bg-dark-surface'}`}
            style={{ borderColor: cardBorder }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[14px]">
                {item.email}
              </AppText>
              <AppText className="font-gilroy-semibold text-[12px]" style={{ color: STATUS_COLORS[item.notification_status] ?? colors.muted }}>
                {t(STATUS_LABELS[item.notification_status] ?? item.notification_status)}
              </AppText>
            </View>
            <AppText className="font-gilroy-medium text-[12px] text-muted">
              {item.phone || '—'} · {item.language.toUpperCase()} · {sourceLabel(item.traffic_source, t)}
              {item.utm_campaign ? ` · ${item.utm_campaign}` : ''}
            </AppText>
            <View className="flex-row items-center justify-between">
              <AppText className="font-gilroy-medium text-[11px] text-muted">{formatStamp(item.registered_at, lang)}</AppText>
              <AppText
                className={`overflow-hidden rounded-full px-2 py-0.5 font-gilroy-semibold text-[11px] ${item.has_account ? 'bg-black/[0.06] dark:bg-white/10' : 'bg-[#eef0ff] text-[#4a4ebe] dark:bg-white/10 dark:text-white'}`}
              >
                {item.has_account ? t('Eventino user') : t('New lead')}
              </AppText>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={UserPlus}
            title={filtered ? t('No registrations match your search') : t('No registrations yet')}
            message={filtered ? undefined : t('Share the pre-sale link. New registrations appear here instantly.')}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : null
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={selected != null} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setSelected(null)}>
          <Pressable
            className="max-h-[80%] rounded-t-[20px] bg-white px-5 pb-5 pt-2 dark:bg-dark-surface"
            onPress={() => undefined}
            accessibilityViewIsModal
            accessibilityLabel={t('Registration details')}
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-black/[0.15] dark:bg-white/20" />
            {selected ? (
              <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}>
                <View className="mb-3 flex-row items-center justify-between gap-3">
                  <AppText numberOfLines={2} className="flex-1 font-gilroy-bold text-[16px]">
                    {selected.email}
                  </AppText>
                  <PressableScale
                    onPress={() => setSelected(null)}
                    accessibilityLabel={t('Close')}
                    className="h-8 w-8 items-center justify-center"
                  >
                    <X size={18} color={iconTint} />
                  </PressableScale>
                </View>
                {[
                  [t('Phone'), selected.phone || '—'],
                  [t('Language'), selected.language.toUpperCase()],
                  [t('Registered'), formatStamp(selected.registered_at, lang)],
                  [t('Source'), sourceLabel(selected.traffic_source, t)],
                  ...DETAIL_FIELDS.map(([field, label]) => [t(label), String(selected[field] || '—')]),
                  [t('Notification'), t(STATUS_LABELS[selected.notification_status] ?? selected.notification_status)],
                  [t('Email sent'), formatStamp(selected.email_sent_at, lang)],
                  [t('SMS sent'), formatStamp(selected.sms_sent_at, lang)],
                  [t('Push sent'), formatStamp(selected.push_sent_at, lang)],
                  [t('Eventino account'), selected.has_account ? t('Has an Eventino account') : t('No Eventino account')],
                ].map(([label, value]) => (
                  <View key={label} className="flex-row gap-3 border-b border-black/[0.05] py-2.5 dark:border-white/10">
                    <AppText className="w-[120px] font-gilroy-medium text-[13px] text-muted">{label}</AppText>
                    <AppText selectable className="flex-1 font-gilroy-medium text-[13px]">
                      {value}
                    </AppText>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>
    </Screen>
  );
}
