import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { FlashList } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Ban, CircleCheck, Copy, Megaphone, Plus, Search, X } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { dateFnsLocale, eventCurrencyCode } from '@/lib/format';
import { formatMoney } from '@/lib/pricing';
import { colors, currencySymbol } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import {
  useCreatePromoterMutation,
  useGetPromotersQuery,
  useGetReferralStatsQuery,
  useGetReferralTimelineQuery,
  useUpdatePromoterMutation,
  type Promoter,
  type ReferralInterval,
  type ReferralStats,
  type ReferralTimelinePoint,
} from '@/store/api/referralsApi';
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
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';

const WEB_ORIGIN = 'https://eventino.co';
const CLICKS_COLOR = '#61859d';
const CONVERSIONS_COLOR = '#34c759';
const CHART_HEIGHT = 120;

function referralUrl(eventSlug: string, eventId: number, code: string): string {
  return `${WEB_ORIGIN}/${eventSlug}/${eventId}?ref=${code}`;
}

function conversionColor(rate: number): string {
  if (rate > 12) return '#34c759';
  if (rate >= 8) return '#ff9500';
  return '#ff0000';
}

function toMoneyNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const keyExtractor = (item: Promoter) => String(item.id);

const ItemSeparator = () => <View className="h-2.5" />;

function MetricCard({ label, value }: { label: string; value: string }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className="w-[48.5%] gap-1 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
        {label}
      </AppText>
      <AppText numberOfLines={1} className="font-gilroy-bold text-[18px]">
        {value}
      </AppText>
    </View>
  );
}

function ReferralMetrics({ stats, currency }: { stats: ReferralStats | undefined; currency: string }) {
  const { t } = useTranslation();
  const revenue = `${currencySymbol(currency)} ${formatMoney(toMoneyNumber(stats?.referred_revenue))}`;
  return (
    <View className="flex-row flex-wrap justify-between gap-y-2.5">
      <MetricCard label={t('Active Promoters')} value={String(stats?.active_promoters ?? 0)} />
      <MetricCard label={t('Total Clicks')} value={String(stats?.total_clicks ?? 0)} />
      <MetricCard label={t('Attributed Orders')} value={String(stats?.attributed_orders ?? 0)} />
      <MetricCard label={t('Conversion Rate')} value={`${(stats?.conversion_rate ?? 0).toFixed(1)}%`} />
      <MetricCard label={t('Referred Revenue')} value={revenue} />
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <AppText className="font-gilroy-medium text-[11px] text-muted">{label}</AppText>
    </View>
  );
}

function TimelineChart({
  points,
  interval,
  onIntervalChange,
  loading,
  lang,
}: {
  points: ReferralTimelinePoint[];
  interval: ReferralInterval;
  onIntervalChange: (value: ReferralInterval) => void;
  loading: boolean;
  lang: string;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const locale = dateFnsLocale(lang);
  const max = Math.max(1, ...points.map((point) => Math.max(point.clicks, point.conversions)));
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <AppText className="font-gilroy-semibold text-[15px]">{t('Clicks & Conversions')}</AppText>
      <SegmentedControl<ReferralInterval>
        value={interval}
        onChange={onIntervalChange}
        options={[
          { value: 'daily', label: t('Daily') },
          { value: 'weekly', label: t('Weekly') },
          { value: 'monthly', label: t('Monthly') },
        ]}
      />
      {loading ? (
        <Skeleton className="w-full rounded-[8px]" style={{ height: CHART_HEIGHT + 24 }} />
      ) : points.length > 0 ? (
        <View className="gap-1">
          <View className="flex-row items-end justify-between gap-1" style={{ height: CHART_HEIGHT }}>
            {points.map((point) => (
              <View key={point.date} className="flex-1 flex-row items-end justify-center gap-[2px]">
                <View
                  className="w-[5px] rounded-t-full"
                  style={{ height: Math.max(2, (point.clicks / max) * CHART_HEIGHT), backgroundColor: CLICKS_COLOR }}
                />
                <View
                  className="w-[5px] rounded-t-full"
                  style={{
                    height: Math.max(2, (point.conversions / max) * CHART_HEIGHT),
                    backgroundColor: CONVERSIONS_COLOR,
                  }}
                />
              </View>
            ))}
          </View>
          <View className="flex-row justify-between gap-1">
            {points.map((point, index) => {
              const parsed = new Date(point.date);
              const showLabel = index % labelEvery === 0 && !Number.isNaN(parsed.getTime());
              return (
                <View key={point.date} className="flex-1 items-center">
                  {showLabel ? (
                    <AppText className="w-12 text-center font-gilroy-medium text-[9px] text-muted">
                      {format(parsed, 'd MMM', { locale })}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No chart data available')}</AppText>
        </View>
      )}
      <View className="flex-row gap-4">
        <LegendDot color={CLICKS_COLOR} label={t('Clicks')} />
        <LegendDot color={CONVERSIONS_COLOR} label={t('Conversions')} />
      </View>
    </View>
  );
}

function PromoterCard({
  promoter,
  currency,
  togglingId,
  onCopyLink,
  onToggle,
}: {
  promoter: Promoter;
  currency: string;
  togglingId: number | null;
  onCopyLink: (code: string) => void;
  onToggle: (promoter: Promoter) => void;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const copyTint = useThemeColor(colors.primary, colors.dark.text);
  const convRate = promoter.clicks > 0 ? (promoter.orders / promoter.clicks) * 100 : 0;
  const badgeColor = conversionColor(convRate);
  const code = promoter.referral_link?.code ?? '';
  const toggling = togglingId === promoter.id;

  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {promoter.name}
          </AppText>
          {promoter.email ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
              {promoter.email}
            </AppText>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: badgeColor }} />
          <AppText className="font-gilroy-semibold text-[12px]" style={{ color: badgeColor }}>
            {convRate.toFixed(1)}%
          </AppText>
        </View>
      </View>

      <View className="flex-row">
        <View className="flex-1">
          <AppText className="font-gilroy-medium text-[11px] text-muted">{t('Clicks')}</AppText>
          <AppText className="font-gilroy-bold text-[14px]">{promoter.clicks || 0}</AppText>
        </View>
        <View className="flex-1">
          <AppText className="font-gilroy-medium text-[11px] text-muted">{t('Orders')}</AppText>
          <AppText className="font-gilroy-bold text-[14px]">{promoter.orders || 0}</AppText>
        </View>
        <View className="flex-1">
          <AppText className="font-gilroy-medium text-[11px] text-muted">{t('Revenue')}</AppText>
          <AppText numberOfLines={1} className="font-gilroy-bold text-[14px]">
            {currencySymbol(currency)} {formatMoney(toMoneyNumber(promoter.revenue))}
          </AppText>
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-1.5">
          <View className="shrink rounded-[6px] bg-black/[0.04] px-2 py-1 dark:bg-white/10">
            <AppText numberOfLines={1} className="font-gilroy-semibold text-[12px]">
              {code || '—'}
            </AppText>
          </View>
          {code ? (
            <PressableScale
              onPress={() => {
                haptics.selection();
                onCopyLink(code);
              }}
              accessibilityLabel={t('Copy')}
              className="h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
            >
              <Copy size={14} color={copyTint} />
            </PressableScale>
          ) : null}
        </View>
        <PressableScale
          onPress={() => {
            haptics.selection();
            onToggle(promoter);
          }}
          disabled={toggling}
          accessibilityLabel={promoter.is_active ? t('Deactivate') : t('Activate')}
          className="h-8 flex-row items-center gap-1.5 rounded-full border border-app-border px-3 dark:border-dark-border"
        >
          {toggling ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : promoter.is_active ? (
            <Ban size={12} color={colors.danger} />
          ) : (
            <CircleCheck size={12} color={CONVERSIONS_COLOR} />
          )}
          <AppText
            className="font-gilroy-semibold text-[12px]"
            style={{ color: promoter.is_active ? colors.danger : CONVERSIONS_COLOR }}
          >
            {promoter.is_active ? t('Deactivate') : t('Activate')}
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}

function RowSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3 w-44" />
        </View>
        <Skeleton className="h-3.5 w-12" />
      </View>
      <View className="flex-row">
        {[0, 1, 2].map((key) => (
          <View key={key} className="flex-1 gap-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-3.5 w-10" />
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-6 w-24 rounded-[6px]" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </View>
    </View>
  );
}

function HeaderSkeleton() {
  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-[74px] w-[48.5%] rounded-[12px]" />
        ))}
      </View>
      <Skeleton className="h-[220px] w-full rounded-[12px]" />
    </View>
  );
}

function AddPromoterModal({
  eventId,
  eventSlug,
  onClose,
}: {
  eventId: number;
  eventSlug: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const submitTint = useThemeColor(colors.white, colors.primary);
  const copyTint = useThemeColor(colors.primary, colors.dark.text);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [createPromoter, { isLoading }] = useCreatePromoterMutation();

  const onCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const result = await createPromoter({ eventId, name: trimmed, notes: notes.trim() }).unwrap();
      const code = result.referral_link?.code;
      if (code) {
        setCreatedLink(referralUrl(eventSlug, eventId, code));
        toast(t('Promoter created successfully'), 'success');
      } else {
        onClose();
      }
    } catch {
      toast(t('Failed to create promoter'), 'error');
    }
  }, [name, notes, createPromoter, eventId, eventSlug, toast, t, onClose]);

  const onCopyCreated = useCallback(async () => {
    haptics.selection();
    await Clipboard.setStringAsync(createdLink);
    toast(t('Link copied!'), 'success');
  }, [createdLink, toast, t]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable
            className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-gilroy-bold text-[20px]">{t('Add New Promoter')}</AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            {!createdLink ? (
              <View className="gap-3">
                <GlassInput
                  label={t('Name')}
                  placeholder={t('Promoter name')}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <GlassInput
                  label={t('Notes')}
                  placeholder={t('Optional notes')}
                  value={notes}
                  onChangeText={setNotes}
                  autoCapitalize="sentences"
                />
                <PressableScale
                  onPress={() => {
                    haptics.selection();
                    void onCreate();
                  }}
                  disabled={isLoading || !name.trim()}
                  accessibilityLabel={t('Create')}
                  className="mt-2 h-[52px] w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white"
                >
                  {isLoading ? (
                    <ActivityIndicator color={submitTint} />
                  ) : (
                    <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">
                      {t('Create')}
                    </AppText>
                  )}
                </PressableScale>
              </View>
            ) : (
              <View className="gap-4">
                <View className="gap-2 rounded-[12px] bg-black/[0.04] p-4 dark:bg-white/10">
                  <AppText className="font-gilroy-semibold text-[13px]">{t('Referral link is ready')}</AppText>
                  <View className="flex-row items-center gap-2">
                    <AppText numberOfLines={2} className="flex-1 font-gilroy-medium text-[12px] text-muted">
                      {createdLink}
                    </AppText>
                    <PressableScale
                      onPress={() => void onCopyCreated()}
                      accessibilityLabel={t('Copy')}
                      className="h-9 flex-row items-center gap-1.5 rounded-full border border-app-border px-3 dark:border-dark-border"
                    >
                      <Copy size={12} color={copyTint} />
                      <AppText className="font-gilroy-semibold text-[12px]">{t('Copy')}</AppText>
                    </PressableScale>
                  </View>
                </View>
                <PressableScale
                  onPress={onClose}
                  accessibilityLabel={t('Close')}
                  className="h-[52px] w-full items-center justify-center rounded-[12px] border border-app-border dark:border-dark-border"
                >
                  <AppText className="font-gilroy-bold text-[16px]">{t('Close')}</AppText>
                </PressableScale>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}

export default function ReferralTrackingScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const scheme = useColorScheme();
  const padding = useScreenPadding();
  const { eventId, data: event } = useSelectedEvent();
  const numericId = eventId ?? 0;
  const spinnerColor = scheme === 'dark' ? '#f9f9f9' : '#2b3a44';

  const [chartInterval, setChartInterval] = useState<ReferralInterval>('daily');
  const [searchInput, setSearchInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const skip = eventId == null;
  const promotersQuery = useGetPromotersQuery(numericId, { skip });
  const statsQuery = useGetReferralStatsQuery(numericId, { skip });
  const timelineQuery = useGetReferralTimelineQuery({ eventId: numericId, interval: chartInterval }, { skip });
  const [updatePromoter] = useUpdatePromoterMutation();

  const promoters = useMemo(() => promotersQuery.data ?? [], [promotersQuery.data]);
  const query = searchInput.trim().toLowerCase();
  const filteredPromoters = useMemo(
    () =>
      query
        ? promoters.filter(
            (promoter) =>
              promoter.name.toLowerCase().includes(query) ||
              (promoter.email ?? '').toLowerCase().includes(query) ||
              (promoter.referral_link?.code ?? '').toLowerCase().includes(query),
          )
        : promoters,
    [promoters, query],
  );

  const currency = event ? eventCurrencyCode(event) : '';
  const eventSlug = event?.slug ?? '';
  const canAddPromoter = Boolean(eventSlug) && !event?.is_cancelled;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([promotersQuery.refetch(), statsQuery.refetch(), timelineQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [promotersQuery, statsQuery, timelineQuery]);

  const onCopyLink = useCallback(
    async (code: string) => {
      if (!eventSlug) return;
      await Clipboard.setStringAsync(referralUrl(eventSlug, numericId, code));
      toast(t('Link copied!'), 'success');
    },
    [eventSlug, numericId, toast, t],
  );

  const onToggle = useCallback(
    async (promoter: Promoter) => {
      if (togglingId) return;
      setTogglingId(promoter.id);
      try {
        await updatePromoter({
          promoterId: promoter.id,
          eventId: numericId,
          isActive: !promoter.is_active,
        }).unwrap();
        toast(promoter.is_active ? t('Promoter deactivated') : t('Promoter activated'), 'success');
      } catch {
        toast(t('Failed to update promoter'), 'error');
      } finally {
        setTogglingId(null);
      }
    },
    [togglingId, updatePromoter, numericId, toast, t],
  );

  const openAddModal = useCallback(() => {
    haptics.selection();
    setShowAddModal(true);
  }, []);

  const referralsLoading = promotersQuery.isLoading || statsQuery.isLoading;
  const loadFailed = promotersQuery.isError || statsQuery.isError;

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Referral Tracking')} onBack={navigate.back} />
      <FlashList
        data={loadFailed ? [] : filteredPromoters}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <PromoterCard
            promoter={item}
            currency={currency}
            togglingId={togglingId}
            onCopyLink={(code) => void onCopyLink(code)}
            onToggle={(promoter) => void onToggle(promoter)}
          />
        )}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View className="gap-3 pb-4">
            <AppText className="font-gilroy-medium text-[13px] text-muted">
              {t('Track promoter performance and referral conversions')}
            </AppText>
            {statsQuery.isLoading ? (
              <HeaderSkeleton />
            ) : loadFailed ? null : (
              <View className="gap-3">
                <ReferralMetrics stats={statsQuery.data} currency={currency} />
                <TimelineChart
                  points={timelineQuery.data ?? []}
                  interval={chartInterval}
                  onIntervalChange={setChartInterval}
                  loading={timelineQuery.isFetching}
                  lang={i18n.language}
                />
                <View className="flex-row items-center justify-between">
                  <AppText className="font-gilroy-bold text-[17px]">{t('Promoters')}</AppText>
                  <PressableScale
                    onPress={openAddModal}
                    disabled={!canAddPromoter}
                    accessibilityLabel={t('Add Promoter')}
                    className={`h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-3.5 dark:bg-white ${canAddPromoter ? '' : 'opacity-40'}`}
                  >
                    <Plus size={14} color={scheme === 'dark' ? colors.primary : colors.white} />
                    <AppText className="font-gilroy-semibold text-[13px] text-white dark:text-primary">
                      {t('Add Promoter')}
                    </AppText>
                  </PressableScale>
                </View>
                <GlassInput
                  placeholder={t('Search promoters...')}
                  value={searchInput}
                  onChangeText={setSearchInput}
                  autoCapitalize="none"
                  leftIcon={<Search size={18} color={colors.muted} />}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          referralsLoading ? (
            <View className="gap-2.5">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : loadFailed ? (
            <EmptyState
              icon={Megaphone}
              title={t('Failed to load referral data')}
              actionLabel={t('Try again')}
              onAction={() => void onRefresh()}
            />
          ) : promoters.length > 0 ? (
            <EmptyState icon={Search} title={t('No promoters found')} />
          ) : (
            <EmptyState
              icon={Megaphone}
              title={t('No promoters found')}
              message={t('Track promoter performance and referral conversions')}
              actionLabel={canAddPromoter ? t('Add Promoter') : undefined}
              onAction={canAddPromoter ? openAddModal : undefined}
            />
          )
        }
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      />
      {showAddModal && eventSlug ? (
        <AddPromoterModal eventId={numericId} eventSlug={eventSlug} onClose={() => setShowAddModal(false)} />
      ) : null}
    </Screen>
  );
}
