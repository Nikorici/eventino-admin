import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Armchair, Check, ChevronDown, ChevronUp, MapPin } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, PressableScale, Screen, SegmentedControl, Skeleton, Stepper } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import { SeatLegend } from '@/components/seatmap/SeatLegend';
import { SeatMapCanvas } from '@/components/seatmap/SeatMapCanvas';
import { OptionSheet, type SheetOption } from '@/components/venue/OptionSheet';
import { PaymentLinks } from '@/components/venue/PaymentLinks';
import { useScreenPadding, useScrollInsets } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { formatMoney } from '@/lib/pricing';
import {
  CATEGORY_PALETTE,
  categoriesForTicketTypes,
  configErrorMessage,
  draftFromConfig,
  emptyDraft,
  isEligibleTicketType,
  readinessChecks,
  seatCategoriesFromRules,
  sectionsFromLayout,
  setAllSectionsTicketType,
  setRowRule,
  statusMapFromConfig,
  summarizeDraft,
  toPayload,
  toggleBlock,
  toggleSeatRule,
  usedTicketTypeIds,
  type ConfigDraft,
} from '@/lib/seating/configState';
import { formatPrice } from '@/lib/seating/pricing';
import { buildSeatIndex, type IndexedSeat } from '@/lib/seating/seatIndex';
import { categoriesById } from '@/lib/seating/selection';
import {
  useDeleteSeatMapConfigMutation,
  useGetSeatMapConfigQuery,
  useLazyGetVenueLayoutQuery,
  usePutSeatMapConfigMutation,
} from '@/store/api/seatingApi';
import { colors } from '@/theme/colors';
import type { SeatMapConfigResponse, SeatMapConfigTicketType, VenueLayoutDetail, VenueLayoutListItem } from '@/types/seating';

type CanvasMode = 'category' | 'block';

function apiErrorParts(error: unknown): { code: string | null; message: string | null } {
  if (typeof error !== 'object' || error === null || !('data' in error)) return { code: null, message: null };
  const data = error.data;
  if (typeof data !== 'object' || data === null) return { code: null, message: null };
  const code = 'code' in data && typeof data.code === 'string' ? data.code : null;
  const message =
    'message' in data && typeof data.message === 'string'
      ? data.message
      : 'detail' in data && typeof data.detail === 'string'
        ? data.detail
        : null;
  return { code, message };
}

function Card({ title, subtitle, children, right }: { title?: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      {title ? (
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <AppText className="font-gilroy-bold text-[16px]">{title}</AppText>
            {subtitle ? <AppText className="mt-0.5 font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">{subtitle}</AppText> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View className="min-w-[30%] flex-1 gap-0.5 rounded-[12px] bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]">
      <AppText className="font-gilroy-medium text-[11px] uppercase tracking-wide text-muted dark:text-dark-muted">{label}</AppText>
      <AppText className="font-gilroy-bold text-[16px]">{value}</AppText>
      {note ? <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{note}</AppText> : null}
    </View>
  );
}

function LayoutPicker({ layouts, busy, onPick }: { layouts: VenueLayoutListItem[]; busy: boolean; onPick: (layoutId: number) => void }) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  if (layouts.length === 0) {
    return (
      <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
        {t('No venue layouts are available yet')}. {t('Ask the Eventino team to add the layout of your venue and it will show up here.')}
      </AppText>
    );
  }
  return (
    <Card title={t('Choose the venue layout')} subtitle={t('The layout defines the sections, rows and seats. You will set the prices in the next step.')}>
      <View className="gap-2">
        {layouts.map((layout) => (
          <View key={layout.id} className="gap-2 rounded-[12px] border px-3 py-3" style={{ borderColor: cardBorder }}>
            <AppText className="font-gilroy-bold text-[15px]">{layout.name}</AppText>
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color={colors.muted} />
              <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {layout.venue?.name}
                {layout.venue?.location ? ` · ${layout.venue.location}` : ''}
              </AppText>
            </View>
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
              {t('Seats')}: {layout.seat_count} · {t('Sections')}: {layout.section_count}
            </AppText>
            <PressableScale onPress={() => onPick(layout.id)} disabled={busy} accessibilityLabel={t('Use this layout')} className="h-10 items-center justify-center rounded-[10px] bg-primary dark:bg-white">
              <AppText className="font-gilroy-semibold text-[14px] text-white dark:text-primary">{t('Use this layout')}</AppText>
            </PressableScale>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ticketTypeLabel(ticketType: SeatMapConfigTicketType, currency: string, multiQrLabel: string): string {
  return `${ticketType.name} · ${formatPrice(Number(ticketType.price) || 0, currency)}${isEligibleTicketType(ticketType) ? '' : ` · ${multiQrLabel}`}`;
}

export default function VenueSeatMapScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const scroll = useScrollInsets();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const { eventId, data: event } = useSelectedEvent();
  const skip = eventId == null;

  const { data: config, isLoading, isError, refetch } = useGetSeatMapConfigQuery(eventId ?? 0, { skip });
  const [fetchLayout, { isFetching: layoutLoading }] = useLazyGetVenueLayoutQuery();
  const [putConfig, { isLoading: saving }] = usePutSeatMapConfigMutation();
  const [deleteConfig, { isLoading: removing }] = useDeleteSeatMapConfigMutation();

  const currency = event?.currency ?? 'MDL';
  const [layout, setLayout] = useState<VenueLayoutDetail | null>(null);
  const [draft, setDraft] = useState<ConfigDraft>(() => emptyDraft());
  const [dirty, setDirty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saveBarHeight, setSaveBarHeight] = useState(0);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('category');
  const [brushTicketTypeId, setBrushTicketTypeId] = useState<number | null>(null);
  const [chooser, setChooser] = useState<{ kind: 'all' } | { kind: 'section'; sectionId: number } | { kind: 'row'; rowId: number; sectionId: number } | null>(null);
  const [openRows, setOpenRows] = useState<Set<number>>(() => new Set());
  const [paletteFor, setPaletteFor] = useState<number | null>(null);

  const applyConfig = useCallback((next: SeatMapConfigResponse) => {
    setLayout(next.layout);
    setDraft(draftFromConfig(next));
    setDirty(false);
  }, []);

  useEffect(() => {
    if (config) applyConfig(config);
  }, [config, applyConfig]);

  const ticketTypes = useMemo(() => config?.ticket_types ?? [], [config]);
  const eligibleTicketTypes = useMemo(() => ticketTypes.filter(isEligibleTicketType), [ticketTypes]);

  useEffect(() => {
    if (brushTicketTypeId === null && eligibleTicketTypes.length > 0) setBrushTicketTypeId(eligibleTicketTypes[0].id);
  }, [brushTicketTypeId, eligibleTicketTypes]);

  const categories = useMemo(() => categoriesForTicketTypes(ticketTypes, draft.category_colors), [ticketTypes, draft.category_colors]);
  const categoriesMap = useMemo(() => categoriesById(categories), [categories]);
  const seatCategories = useMemo(() => (layout ? seatCategoriesFromRules(layout, draft.rowRules, draft.seatRules) : {}), [layout, draft.rowRules, draft.seatRules]);
  const index = useMemo(() => (layout ? buildSeatIndex(layout, draft.sections, seatCategories) : null), [layout, draft.sections, seatCategories]);
  const blockMode = canvasMode === 'block';
  const statuses = useMemo(
    () => statusMapFromConfig(config?.statuses, blockMode ? new Map() : draft.blocks),
    [config?.statuses, draft.blocks, blockMode],
  );
  const selectedSeatIds = useMemo(
    () => new Set<number>(blockMode ? Array.from(draft.blocks.keys()) : Array.from(draft.seatRules.keys())),
    [blockMode, draft.blocks, draft.seatRules],
  );
  const summary = useMemo(() => summarizeDraft(index, categoriesMap, draft.blocks, config?.statuses), [index, categoriesMap, draft.blocks, config?.statuses]);
  const checks = useMemo(() => readinessChecks(draft), [draft]);
  const sectionsCheck = checks.find((check) => check.key === 'sections');
  const isReady = checks.every((check) => check.done);
  const usedIds = useMemo(() => usedTicketTypeIds(draft), [draft]);
  const usedCategories = useMemo(() => categories.filter((category) => usedIds.includes(category.ticket_type_id)), [categories, usedIds]);
  const summaryByType = useMemo(() => new Map(summary.byTicketType.map((item) => [item.ticket_type_id, item])), [summary]);
  const layoutSections = useMemo(() => new Map((layout?.sections ?? []).map((section) => [section.id, section])), [layout]);

  const isNew = !config?.seat_map;
  const isLive = draft.status === 'active';
  const tableMode = config?.seat_map?.scope === 'tables';
  const canSave = !saving && Boolean(draft.layout_id) && (dirty || isNew);
  const missingSections = sectionsCheck ? sectionsCheck.total - sectionsCheck.configured : 0;

  const updateDraft = useCallback((updater: (previous: ConfigDraft) => ConfigDraft) => {
    setDraft(updater);
    setDirty(true);
  }, []);

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const pickLayout = async (layoutId: number) => {
    haptics.light();
    try {
      const result = await fetchLayout(layoutId).unwrap();
      setLayout(result);
      updateDraft((previous) => ({
        ...previous,
        layout_id: result.id,
        sections: sectionsFromLayout(result),
        rowRules: new Map(),
        seatRules: new Map(),
        blocks: new Map(),
      }));
    } catch {
      toast(t('Could not load the venue layout'), 'error');
    }
  };

  const onSeatPress = useCallback(
    (seat: IndexedSeat) => {
      haptics.selection();
      if (blockMode) {
        updateDraft((previous) => ({ ...previous, blocks: toggleBlock(previous.blocks, seat.id) }));
        return;
      }
      if (brushTicketTypeId === null) {
        toast(t('Pick a ticket type to paint first'), 'info');
        return;
      }
      updateDraft((previous) => ({ ...previous, seatRules: toggleSeatRule(previous.seatRules, seat.id, brushTicketTypeId) }));
    },
    [blockMode, brushTicketTypeId, updateDraft, toast, t],
  );

  const handleSave = async () => {
    if (eventId == null) return;
    if (!draft.layout_id) {
      toast(t('Pick a venue layout first'), 'error');
      return;
    }
    try {
      const result = await putConfig({ eventId, body: toPayload(draft) }).unwrap();
      haptics.success();
      applyConfig(result);
      toast(t('Seat map saved'), 'success');
    } catch (error) {
      haptics.error();
      const { code, message } = apiErrorParts(error);
      toast(t(configErrorMessage(code, message ?? t('Could not save the seat map. Please try again.'))), 'error');
    }
  };

  const handleDiscard = () => {
    if (config) applyConfig(config);
  };

  const confirmRemove = () => {
    if (eventId == null) return;
    confirmAction({
      title: t('Remove the seat map?'),
      message: t('Buyers will no longer pick seats for this event and seats currently held in carts will be released. Tickets that were already sold keep their seat.'),
      cancelLabel: t('Keep seat map'),
      confirmLabel: t('Remove seat map'),
      destructive: true,
      onConfirm: () => {
        deleteConfig(eventId)
          .unwrap()
          .then(() => {
            toast(t('Seat map removed'), 'success');
            setLayout(null);
            setDraft(emptyDraft());
            setDirty(false);
          })
          .catch((error: unknown) => {
            const { code, message } = apiErrorParts(error);
            toast(t(configErrorMessage(code, message ?? t('Could not remove the seat map. Please try again.'))), 'error');
          });
      },
    });
  };

  const chooserOptions = (extraLabel: string): SheetOption[] => [
    { value: null, label: extraLabel },
    ...ticketTypes.map((ticketType) => ({ value: ticketType.id, label: ticketTypeLabel(ticketType, currency, t('multi-QR')), disabled: !isEligibleTicketType(ticketType) })),
  ];

  const stepLabel = (key: 'layout' | 'sections' | 'live') => {
    if (key === 'layout') return t('Layout');
    if (key === 'sections') {
      return sectionsCheck && sectionsCheck.total > 0
        ? t('Ticket types {{configured}}/{{total}}', { configured: sectionsCheck.configured, total: sectionsCheck.total })
        : t('Ticket types');
    }
    return t('Publish');
  };

  const editorSubtitle = tableMode
    ? blockMode
      ? t('Tap a table to take it off sale. Tap it again to put it back. Sold and reserved tables cannot be changed.')
      : t('Tap a table to give it the selected ticket type. Tap it again to go back to its tier price.')
    : blockMode
      ? t('Zoom into a section, then tap a seat to take it off sale. Tap it again to put it back. Sold and reserved seats cannot be changed.')
      : t('Zoom into a section, then tap a seat to give it the selected ticket type. Tap it again to go back to the section price.');

  const renderBody = () => {
    if (isLoading && !config) {
      return (
        <View style={{ paddingTop: padding.top }} className="gap-3 px-4">
          <Skeleton className="h-24 w-full rounded-[14px]" />
          <Skeleton className="h-64 w-full rounded-[14px]" />
        </View>
      );
    }
    if (isError || !config || eventId == null) {
      return (
        <View style={{ paddingTop: padding.top }} className="flex-1 justify-center">
          <EmptyState icon={Armchair} title={t('Could not load the seat map configuration')} actionLabel={t('Retry')} onAction={() => void refetch()} />
        </View>
      );
    }

    return (
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scroll.scrollProps}
        contentContainerStyle={{ paddingTop: scroll.paddingTop + (dirty ? saveBarHeight + 12 : 0), paddingBottom: scroll.paddingBottom, paddingHorizontal: 16 }}
        refreshControl={dirty ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.muted} progressViewOffset={scroll.refreshOffset} />}
      >
        <View className="gap-4">
          <Card
            title={t('Seat map')}
            subtitle={layout ? `${layout.name}${layout.venue?.name ? ` · ${layout.venue.name}` : ''}` : t('Attendees pick numbered seats on a venue layout. Start by choosing the layout of your venue.')}
            right={
              <View className="h-6 justify-center rounded-full px-2.5" style={{ backgroundColor: isLive ? 'rgba(15,159,95,0.14)' : 'rgba(138,141,147,0.16)' }}>
                <AppText className="font-gilroy-bold text-[10px] uppercase tracking-[0.5px]" style={{ color: isLive ? '#0f9f5f' : colors.muted }}>
                  {isLive ? t('Published') : t('Draft')}
                </AppText>
              </View>
            }
          >
            {layout && index ? (
              <>
                <View className="flex-row flex-wrap gap-2">
                  <Figure label={t('Seats in venue')} value={String(summary.totalSeats)} />
                  <Figure label={t('On sale')} value={String(summary.sellableSeats)} note={summary.unassignedSeats > 0 ? t('{{seats}} without a ticket type', { seats: summary.unassignedSeats }) : undefined} />
                  <Figure label={t('Sold')} value={String(summary.soldSeats)} note={summary.reservedSeats > 0 ? t('{{count}} reserved right now', { count: summary.reservedSeats }) : undefined} />
                  <Figure label={t('Blocked')} value={String(summary.blockedSeats)} />
                  <Figure label={t('If sold out')} value={`${formatMoney(summary.potentialRevenue)} ${currency}`} />
                </View>
                {!isReady ? (
                  <View className="flex-row flex-wrap gap-2">
                    {checks.map((check, position) => (
                      <View key={check.key} className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: check.done ? 'rgba(15,159,95,0.14)' : 'rgba(43,58,68,0.08)' }}>
                        {check.done ? <Check size={12} color="#0f9f5f" strokeWidth={3} /> : <AppText className="font-gilroy-bold text-[11px]">{position + 1}</AppText>}
                        <AppText className="font-gilroy-semibold text-[12px]" style={check.done ? { color: '#0f9f5f' } : undefined}>
                          {stepLabel(check.key)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {!isNew ? (
              <PressableScale onPress={confirmRemove} disabled={saving || removing} accessibilityLabel={t('Remove seat map')} className="h-10 items-center justify-center rounded-[10px] border border-danger/40">
                <AppText className="font-gilroy-semibold text-[14px] text-danger dark:text-danger">{removing ? t('Removing...') : t('Remove seat map')}</AppText>
              </PressableScale>
            ) : null}
          </Card>

          {isNew && !layout ? <LayoutPicker layouts={config.layouts} busy={layoutLoading} onPick={(layoutId) => void pickLayout(layoutId)} /> : null}

          {config.seat_map ? <PaymentLinks eventId={eventId} /> : null}

          {layout && index ? (
            <>
              <Card title={t('Sales settings')}>
                <View className="gap-1.5">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Visibility')}</AppText>
                  <SegmentedControl
                    value={isLive ? 'active' : 'draft'}
                    onChange={(next) => updateDraft((previous) => ({ ...previous, status: next === 'active' ? 'active' : 'draft' }))}
                    options={[
                      { value: 'draft', label: t('Draft') },
                      { value: 'active', label: t('Published') },
                    ]}
                  />
                </View>
                <View className="flex-row items-center justify-between">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Hold time (minutes)')}</AppText>
                  <Stepper value={Math.round(draft.hold_ttl_seconds / 60)} min={1} max={60} onChange={(minutes) => updateDraft((previous) => ({ ...previous, hold_ttl_seconds: minutes * 60 }))} />
                </View>
                <View className="flex-row items-center justify-between">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Max seats per order')}</AppText>
                  <Stepper value={draft.max_seats_per_order} min={1} max={50} onChange={(max) => updateDraft((previous) => ({ ...previous, max_seats_per_order: max }))} />
                </View>
                <AppText className="font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">
                  {isLive
                    ? t('Buyers pick their seats on the event page. Picked seats stay reserved for the hold time while they check out.')
                    : t('Hidden from buyers while you set up prices. Picked seats stay reserved for the hold time while they check out.')}
                </AppText>
                {isNew ? (
                  <PressableScale
                    onPress={() => {
                      setLayout(null);
                      updateDraft((previous) => ({ ...previous, layout_id: null, sections: [] }));
                    }}
                    accessibilityLabel={t('Choose a different layout')}
                    className="self-start"
                  >
                    <AppText className="font-gilroy-semibold text-[13px] text-links">{t('Choose a different layout')}</AppText>
                  </PressableScale>
                ) : null}
              </Card>

              <Card
                title={t('Sections')}
                subtitle={missingSections > 0 ? t('{{count}} sections on sale still need a ticket type', { count: missingSections }) : t('Each section sells as one ticket type. Rows and single seats can override it.')}
                right={
                  eligibleTicketTypes.length > 0 ? (
                    <PressableScale onPress={() => setChooser({ kind: 'all' })} accessibilityLabel={t('Apply to all')} className="rounded-full border border-app-border px-3 py-1.5 dark:border-dark-border">
                      <AppText className="font-gilroy-semibold text-[12px]">{t('Apply to all')}</AppText>
                    </PressableScale>
                  ) : null
                }
              >
                {eligibleTicketTypes.length === 0 ? (
                  <AppText className="font-gilroy-medium text-[12px] text-danger dark:text-danger">{t('Create at least one ticket type that issues a single QR code to price the seats.')}</AppText>
                ) : null}
                <View className="gap-2">
                  {draft.sections.map((section) => {
                    const layoutSection = layoutSections.get(section.section_id);
                    const rows = layoutSection?.rows ?? [];
                    const rowRuleCount = rows.filter((row) => draft.rowRules.has(row.id)).length;
                    const needsTicketType = section.is_active && section.ticket_type_id === null;
                    const category = section.ticket_type_id !== null ? categories.find((item) => item.ticket_type_id === section.ticket_type_id) : null;
                    const ticketType = ticketTypes.find((item) => item.id === section.ticket_type_id);
                    const rowsOpen = openRows.has(section.section_id);
                    return (
                      <View key={section.section_id} className={cn('gap-2 rounded-[12px] border px-3 py-3', !section.is_active && 'opacity-60')} style={{ borderColor: needsTicketType ? colors.danger : cardBorder }}>
                        <View className="flex-row items-center gap-3">
                          <View className="h-4 w-4 rounded-full" style={{ backgroundColor: category?.color ?? '#d1d5db' }} />
                          <View className="flex-1">
                            <AppText className="font-gilroy-semibold text-[14px]">{section.name}</AppText>
                            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{t('{{count}} seats', { count: section.seat_count })}</AppText>
                          </View>
                          <Switch
                            value={section.is_active}
                            accessibilityLabel={t('Section on sale')}
                            onValueChange={(is_active) => {
                              haptics.selection();
                              updateDraft((previous) => ({ ...previous, sections: previous.sections.map((item) => (item.section_id === section.section_id ? { ...item, is_active } : item)) }));
                            }}
                            trackColor={{ true: colors.primary, false: '#d1d1d6' }}
                            thumbColor={colors.white}
                          />
                        </View>
                        <PressableScale
                          onPress={() => setChooser({ kind: 'section', sectionId: section.section_id })}
                          disabled={!section.is_active}
                          accessibilityLabel={t('Ticket type for {{section}}', { section: section.name })}
                          className="h-11 flex-row items-center justify-between rounded-[10px] border border-app-border px-3 dark:border-dark-border"
                        >
                          <AppText numberOfLines={1} className={cn('flex-1 font-gilroy-medium text-[14px]', !ticketType && 'text-muted dark:text-dark-muted')}>
                            {ticketType ? ticketTypeLabel(ticketType, currency, t('multi-QR')) : needsTicketType ? t('Choose a ticket type') : t('Not configured')}
                          </AppText>
                          <ChevronDown size={16} color={colors.muted} />
                        </PressableScale>
                        {rows.length > 0 && section.is_active ? (
                          <PressableScale
                            onPress={() =>
                              setOpenRows((previous) => {
                                const next = new Set(previous);
                                if (next.has(section.section_id)) next.delete(section.section_id);
                                else next.add(section.section_id);
                                return next;
                              })
                            }
                            accessibilityLabel={t('Price rows differently')}
                            className="flex-row items-center gap-1 self-start"
                          >
                            <AppText className="font-gilroy-semibold text-[12px] text-links">
                              {rowRuleCount > 0 ? t('{{count}} rows priced differently', { count: rowRuleCount }) : t('Price rows differently')}
                            </AppText>
                            {rowsOpen ? <ChevronUp size={14} color={colors.links} /> : <ChevronDown size={14} color={colors.links} />}
                          </PressableScale>
                        ) : null}
                        {rowsOpen && section.is_active ? (
                          <View className="gap-1.5">
                            {rows.map((row) => {
                              const ruleType = ticketTypes.find((item) => item.id === draft.rowRules.get(row.id));
                              return (
                                <PressableScale
                                  key={row.id}
                                  onPress={() => setChooser({ kind: 'row', rowId: row.id, sectionId: section.section_id })}
                                  accessibilityLabel={t('Ticket type for row {{row}}', { row: row.label })}
                                  className="h-10 flex-row items-center justify-between rounded-[10px] bg-black/[0.03] px-3 dark:bg-white/[0.05]"
                                >
                                  <AppText className="font-gilroy-medium text-[13px]">{t('Row {{row}}', { row: row.label })}</AppText>
                                  <AppText className={cn('font-gilroy-semibold text-[12px]', !ruleType && 'text-muted dark:text-dark-muted')}>
                                    {ruleType ? ruleType.name : t('Same as section')}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Card>

              {usedCategories.length > 0 ? (
                <Card title={t('Price categories')} subtitle={t('Colours are what buyers see on the map. Tap a swatch to change it.')}>
                  <View className="gap-2">
                    {usedCategories.map((category) => {
                      const item = summaryByType.get(category.ticket_type_id);
                      return (
                        <View key={category.ticket_type_id} className="gap-2">
                          <View className="flex-row items-center gap-3">
                            <PressableScale
                              onPress={() => setPaletteFor((current) => (current === category.ticket_type_id ? null : category.ticket_type_id))}
                              accessibilityLabel={t('Change colour')}
                              className="h-7 w-7 rounded-full border border-black/10"
                              style={{ backgroundColor: category.color }}
                            >
                              <View />
                            </PressableScale>
                            <View className="flex-1">
                              <AppText className="font-gilroy-semibold text-[14px]">{category.name}</AppText>
                              <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
                                {formatPrice(Number(category.price) || 0, currency)} · {t('Seats')}: {item?.seats ?? 0} · {t('If sold out')}: {formatMoney(item?.revenue ?? 0)} {currency}
                              </AppText>
                            </View>
                          </View>
                          {paletteFor === category.ticket_type_id ? (
                            <View className="flex-row flex-wrap gap-2 pl-10">
                              {CATEGORY_PALETTE.map((hex) => (
                                <PressableScale
                                  key={hex}
                                  onPress={() => {
                                    haptics.selection();
                                    updateDraft((previous) => ({ ...previous, category_colors: { ...previous.category_colors, [String(category.ticket_type_id)]: hex } }));
                                    setPaletteFor(null);
                                  }}
                                  accessibilityLabel={hex}
                                  className={cn('h-7 w-7 items-center justify-center rounded-full', category.color === hex && 'border-2 border-primary dark:border-white')}
                                  style={{ backgroundColor: hex }}
                                >
                                  <View />
                                </PressableScale>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <View className="flex-row items-center justify-between border-t border-app-border pt-2 dark:border-dark-border">
                      <AppText className="font-gilroy-semibold text-[13px]">{t('Total if sold out')}</AppText>
                      <AppText className="font-gilroy-bold text-[13px]">
                        {summary.sellableSeats} · {formatMoney(summary.potentialRevenue)} {currency}
                      </AppText>
                    </View>
                  </View>
                </Card>
              ) : null}

              <Card title={tableMode ? t('Table editor') : t('Seat editor')} subtitle={editorSubtitle}>
                <SegmentedControl<CanvasMode>
                  value={canvasMode}
                  onChange={setCanvasMode}
                  options={[
                    { value: 'category', label: tableMode ? t('Table pricing') : t('Seat pricing') },
                    {
                      value: 'block',
                      label: tableMode
                        ? t('Blocked tables ({{count}})', { count: draft.blocks.size })
                        : t('Blocked seats ({{count}})', { count: draft.blocks.size }),
                    },
                  ]}
                />
                {!blockMode && eligibleTicketTypes.length > 0 ? (
                  <View className="gap-1.5">
                    <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{tableMode ? t('Paint tables with') : t('Paint seats with')}</AppText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
                      {eligibleTicketTypes.map((ticketType) => (
                        <Chip key={ticketType.id} label={ticketTypeLabel(ticketType, currency, t('multi-QR'))} selected={brushTicketTypeId === ticketType.id} onPress={() => setBrushTicketTypeId(ticketType.id)} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <View className="overflow-hidden rounded-[14px] border border-app-border dark:border-dark-border" style={{ height: 360 }}>
                  <SeatMapCanvas
                    index={index}
                    layout={layout}
                    categories={categoriesMap}
                    statuses={statuses}
                    selectedSeatIds={selectedSeatIds}
                    language={i18n.language}
                    onSeatPress={onSeatPress}
                  />
                </View>
                <SeatLegend categories={usedCategories} currency={currency} />
              </Card>
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    );
  };

  return (
    <Screen edges={[]}>
      {renderBody()}
      <GlassHeader title={t('Seat map')} onBack={navigate.back} />
      {dirty ? (
        <View
          className="absolute left-4 right-4 gap-2 rounded-[14px] border border-app-border bg-app-bg px-4 py-3 dark:border-dark-border dark:bg-dark-bg"
          style={{ top: padding.top, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          onLayout={(layoutEvent) => setSaveBarHeight(layoutEvent.nativeEvent.layout.height)}
        >
          <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('You have unsaved changes to the seat map.')}</AppText>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <PressableScale onPress={handleDiscard} disabled={saving} accessibilityLabel={t('Discard')} className="h-11 w-full items-center justify-center rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface">
                <AppText className="font-gilroy-semibold text-[15px]">{t('Discard')}</AppText>
              </PressableScale>
            </View>
            <View className="flex-1">
              <PressableScale onPress={() => void handleSave()} disabled={!canSave} accessibilityLabel={t('Save changes')} className={cn('h-11 w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white', !canSave && 'opacity-50')}>
                {saving ? <ActivityIndicator color={colors.muted} /> : <AppText className="font-gilroy-semibold text-[15px] text-white dark:text-primary">{saving ? t('Saving...') : t('Save changes')}</AppText>}
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}
      {chooser?.kind === 'all' ? (
        <OptionSheet
          title={t('Apply one ticket type to every section')}
          options={chooserOptions(t('Choose a ticket type')).slice(1)}
          value={null}
          onPick={(ticketTypeId) => {
            if (ticketTypeId !== null) updateDraft((previous) => ({ ...previous, sections: setAllSectionsTicketType(previous.sections, ticketTypeId) }));
            setChooser(null);
          }}
          onClose={() => setChooser(null)}
        />
      ) : null}
      {chooser?.kind === 'section' ? (
        <OptionSheet
          title={t('Ticket type')}
          options={chooserOptions(t('Not configured'))}
          value={draft.sections.find((section) => section.section_id === chooser.sectionId)?.ticket_type_id ?? null}
          onPick={(ticketTypeId) => {
            updateDraft((previous) => ({ ...previous, sections: previous.sections.map((item) => (item.section_id === chooser.sectionId ? { ...item, ticket_type_id: ticketTypeId } : item)) }));
            setChooser(null);
          }}
          onClose={() => setChooser(null)}
        />
      ) : null}
      {chooser?.kind === 'row' ? (
        <OptionSheet
          title={t('Ticket type for row {{row}}', { row: layoutSections.get(chooser.sectionId)?.rows.find((row) => row.id === chooser.rowId)?.label ?? '' })}
          options={chooserOptions(t('Same as section'))}
          value={draft.rowRules.get(chooser.rowId) ?? null}
          onPick={(ticketTypeId) => {
            updateDraft((previous) => ({ ...previous, rowRules: setRowRule(previous.rowRules, chooser.rowId, ticketTypeId) }));
            setChooser(null);
          }}
          onClose={() => setChooser(null)}
        />
      ) : null}
    </Screen>
  );
}
