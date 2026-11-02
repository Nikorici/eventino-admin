import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Armchair, Building2, LayoutGrid, MapPin, Pencil, RotateCcw, Ticket, X } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ArenaPreview } from '@/components/venue/ArenaPreview';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { CATEGORY_PALETTE } from '@/lib/seating/configState';
import {
  useAssignVenueToEventMutation,
  useAssignZoneToEventMutation,
  useCreateVenueMutation,
  useDeleteEventZoneMutation,
  useDeleteVenueMutation,
  useGetEventVenuesQuery,
  useGetEventZonesQuery,
  useUpdateEventZoneMutation,
  useUpdateZoneMutation,
  type EventVenue,
  type EventZone,
  type VenueTemplate,
  type VenueZone,
} from '@/store/api/venueApi';
import { colors, currencySymbol } from '@/theme/colors';
import type { TicketType } from '@/types/api';
import type { EventSeatMapSummary } from '@/types/seating';

const ACCENT_GREEN = '#34c759';
const ACCENT_BLUE = '#61859d';

const TEMPLATES: { id: VenueTemplate; label: string; sub: string }[] = [
  { id: 'standard_arena', label: 'Standard Arena', sub: '17 sections' },
  { id: 'simple_3', label: 'Simple 3-Section', sub: '3 sections' },
  { id: 'balcon', label: 'Balcon', sub: '4 sections' },
];

const TEMPLATE_LABELS: Record<string, string> = {
  standard_arena: 'Standard Arena',
  simple_3: 'Simple 3-Section',
  balcon: 'Balcon',
  seat_map: 'Seat map',
  tables: 'Table map',
};

function templateLabel(template: string, t: TFunction): string {
  const label = TEMPLATE_LABELS[template];
  return label ? t(label) : template;
}

function formatPrice(value: string | null, currency: string): string | null {
  if (value == null || value === '') return null;
  const symbol = currencySymbol(currency);
  const numeric = Number(value);
  const amount = Number.isNaN(numeric)
    ? value
    : numeric.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return symbol.length === 1 ? `${symbol}${amount}` : `${symbol} ${amount}`;
}

function StatPill({ label, value }: { label: string; value: string }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className="flex-1 gap-0.5 rounded-[12px] border bg-card-sm px-3 py-2.5 dark:bg-dark-elevated"
      style={{ borderColor: cardBorder }}
    >
      <AppText className="font-gilroy-medium text-[11px] uppercase tracking-wide text-muted dark:text-dark-muted">{label}</AppText>
      <AppText className="font-gilroy-bold text-[16px]">{value}</AppText>
    </View>
  );
}

function StatusPill({ active, t }: { active: boolean; t: TFunction }) {
  const tint = active ? ACCENT_GREEN : colors.muted;
  return (
    <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${tint}1f` }}>
      <AppText className="font-gilroy-semibold text-[11px]" style={{ color: tint }}>
        {active ? t('Active') : t('Inactive')}
      </AppText>
    </View>
  );
}

function ZoneRow({ zone, mapping, currency, t }: { zone: VenueZone; mapping: EventZone | null; currency: string; t: TFunction }) {
  const ticketTypeName = mapping?.ticket_type_name ?? null;
  const price = mapping ? formatPrice(mapping.price_override ?? mapping.ticket_type_price, currency) : null;
  const isActive = mapping?.is_active_override ?? zone.is_active;
  return (
    <View className="flex-row items-start gap-3 py-3">
      <View
        className="mt-0.5 h-9 w-9 rounded-[9px]"
        style={{ backgroundColor: zone.color, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
      />
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[14px]">
            {zone.name}
          </AppText>
          {zone.template_slot_id ? (
            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{zone.template_slot_id}</AppText>
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Armchair size={13} color={colors.muted} />
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{zone.capacity}</AppText>
          </View>
          {ticketTypeName ? (
            <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: `${ACCENT_BLUE}18` }}>
              <Ticket size={12} color={ACCENT_BLUE} />
              <AppText numberOfLines={1} className="font-gilroy-semibold text-[11px]" style={{ color: ACCENT_BLUE }}>
                {ticketTypeName}
              </AppText>
            </View>
          ) : (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${colors.muted}18` }}>
              <AppText className="font-gilroy-semibold text-[11px] text-muted dark:text-dark-muted">{t('Not configured')}</AppText>
            </View>
          )}
          {price ? <AppText className="font-gilroy-bold text-[13px]">{price}</AppText> : null}
        </View>
        {zone.comment ? <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{zone.comment}</AppText> : null}
      </View>
      <StatusPill active={isActive} t={t} />
    </View>
  );
}

function SeatMapCard({ seatMap, tables, currency, t, onConfigure }: { seatMap: EventSeatMapSummary; tables: boolean; currency: string; t: TFunction; onConfigure: () => void }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const buttonIconTint = useThemeColor(colors.white, colors.primary);
  const priceMin = formatPrice(seatMap.price_min, currency);
  const priceMax = formatPrice(seatMap.price_max, currency);
  const priceRange = priceMin && priceMax ? (priceMin === priceMax ? priceMin : `${priceMin} – ${priceMax}`) : null;
  const configureLabel = tables ? t('Configure table map') : t('Configure seat map');
  return (
    <>
      <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-card-sm dark:bg-dark-elevated">
            <Armchair size={20} color={headerIconTint} />
          </View>
          <View className="flex-1">
            <AppText numberOfLines={1} className="font-gilroy-bold text-[16px]">
              {seatMap.layout_name}
            </AppText>
            <View className="mt-0.5 flex-row items-center gap-1">
              <MapPin size={12} color={colors.muted} />
              <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {seatMap.venue_name}
              </AppText>
            </View>
          </View>
          <View className="items-end gap-1">
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${ACCENT_BLUE}18` }}>
              <AppText className="font-gilroy-semibold text-[11px]" style={{ color: ACCENT_BLUE }}>
                {templateLabel(tables ? 'tables' : 'seat_map', t)}
              </AppText>
            </View>
            <StatusPill active={seatMap.status === 'active'} t={t} />
          </View>
        </View>
        <View className="flex-row gap-2">
          <StatPill label={tables ? t('Total tables') : t('Total seats')} value={String(seatMap.seat_count)} />
          <StatPill label={tables ? t('Available tables') : t('Available seats')} value={String(seatMap.available_seats)} />
        </View>
        <View className="flex-row gap-2">
          <StatPill label={t('Max seats per order')} value={String(seatMap.max_seats_per_order)} />
          <StatPill label={t('Hold time')} value={t('{{minutes}} min', { minutes: Math.round(seatMap.hold_ttl_seconds / 60) })} />
        </View>
        {priceRange ? <StatPill label={t('Price range')} value={priceRange} /> : null}
      </View>

      <PressableScale onPress={onConfigure} accessibilityLabel={configureLabel} className="h-12 flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white">
        <Armchair size={16} color={buttonIconTint} />
        <AppText className="font-gilroy-semibold text-[15px] text-white dark:text-primary">{configureLabel}</AppText>
      </PressableScale>
    </>
  );
}

function ChoiceCard({ title, description, onPress, disabled }: { title: string; description: string; onPress: () => void; disabled?: boolean }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityLabel={title} className={cn('gap-1 rounded-[14px] border bg-white p-4 dark:bg-dark-surface', disabled && 'opacity-50')} style={{ borderColor: cardBorder }}>
      <AppText className="font-gilroy-bold text-[15px]">{title}</AppText>
      <AppText className="font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">{description}</AppText>
    </PressableScale>
  );
}

interface ZoneEditSheetProps {
  eventId: number;
  eventVenueId: number;
  zone: VenueZone;
  mapping: EventZone | null;
  ticketTypes: TicketType[];
  currency: string;
  onClose: () => void;
}

function ZoneEditSheet({ eventId, eventVenueId, zone, mapping, ticketTypes, currency, onClose }: ZoneEditSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const { height: windowHeight } = useWindowDimensions();
  const [name, setName] = useState(zone.name);
  const [capacity, setCapacity] = useState(String(zone.capacity));
  const [comment, setComment] = useState(zone.comment ?? '');
  const [color, setColor] = useState(zone.color);
  const [isActive, setIsActive] = useState(zone.is_active);
  const [ticketTypeId, setTicketTypeId] = useState<number | null>(mapping?.ticket_type ?? null);
  const [priceOverride, setPriceOverride] = useState(mapping?.price_override ?? '');
  const [saving, setSaving] = useState(false);
  const [updateZone] = useUpdateZoneMutation();
  const [assignZone] = useAssignZoneToEventMutation();
  const [updateEventZone] = useUpdateEventZoneMutation();
  const [deleteEventZone] = useDeleteEventZoneMutation();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const patch: Record<string, string | number | boolean> = {};
      if (name.trim() !== zone.name) patch.name = name.trim();
      if (Number(capacity) !== zone.capacity) patch.capacity = Number(capacity) || 0;
      if (comment !== (zone.comment ?? '')) patch.comment = comment;
      if (color !== zone.color) patch.color = color;
      if (isActive !== zone.is_active) patch.is_active = isActive;
      if (Object.keys(patch).length > 0) await updateZone({ eventId, zoneId: zone.id, patch }).unwrap();

      const previousType = mapping?.ticket_type ?? null;
      let eventZoneId = mapping?.id ?? null;
      if (ticketTypeId === null && mapping) {
        await deleteEventZone({ eventId, eventZoneId: mapping.id }).unwrap();
        eventZoneId = null;
      } else if (ticketTypeId !== null && !mapping) {
        const created = await assignZone({ eventId, eventVenueId, zoneId: zone.id, ticketTypeId }).unwrap();
        eventZoneId = created.id;
      } else if (ticketTypeId !== null && mapping && ticketTypeId !== previousType) {
        await updateEventZone({ eventId, eventZoneId: mapping.id, patch: { ticket_type: ticketTypeId } }).unwrap();
      }

      const nextPrice = priceOverride.trim() === '' ? null : Number(priceOverride);
      const previousPrice = mapping?.price_override == null ? null : Number(mapping.price_override);
      if (eventZoneId !== null && nextPrice !== previousPrice) {
        await updateEventZone({ eventId, eventZoneId, patch: { price_override: nextPrice } }).unwrap();
      } else if (eventZoneId === null && nextPrice !== null) {
        toast(t('Pick a ticket type before setting a custom price'), 'info');
      }
      haptics.success();
      toast(t('Zone saved'), 'success');
      onClose();
    } catch (error) {
      haptics.error();
      const message = extractApiError(error);
      toast(message ? t(message) : t('Update failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View className="rounded-t-[24px] bg-app-bg px-5 pt-4 dark:bg-dark-bg" style={{ paddingBottom: insets.bottom + 12, maxHeight: windowHeight * 0.88 }}>
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <AppText numberOfLines={1} className="flex-1 font-gilroy-bold text-[20px]">
                {zone.name}
              </AppText>
              <PressableScale onPress={onClose} accessibilityLabel={t('Close')} className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
                <X size={18} color={colors.muted} />
              </PressableScale>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-3">
                <GlassInput label={t('Zone name')} value={name} onChangeText={setName} />
                <GlassInput label={t('Capacity')} value={capacity} keyboardType="number-pad" onChangeText={(next) => setCapacity(next.replace(/\D/g, ''))} />
                <View className="gap-1.5">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Colour')}</AppText>
                  <View className="flex-row flex-wrap gap-2">
                    {[zone.color, ...CATEGORY_PALETTE.filter((hex) => hex !== zone.color)].map((hex) => (
                      <PressableScale key={hex} onPress={() => setColor(hex)} accessibilityLabel={hex} className={cn('h-8 w-8 rounded-full', color === hex && 'border-2 border-primary dark:border-white')} style={{ backgroundColor: hex }}>
                        <View />
                      </PressableScale>
                    ))}
                  </View>
                </View>
                <View className="gap-1.5">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Ticket Type')}</AppText>
                  <View className="flex-row flex-wrap gap-2">
                    <PressableScale onPress={() => setTicketTypeId(null)} accessibilityLabel={t('Not configured')} className={cn('h-9 justify-center rounded-full border px-3', ticketTypeId === null ? 'border-primary bg-primary dark:border-white dark:bg-white' : 'border-app-border dark:border-dark-border')}>
                      <AppText className={cn('font-gilroy-medium text-[12px]', ticketTypeId === null ? 'text-white dark:text-primary' : '')}>{t('Not configured')}</AppText>
                    </PressableScale>
                    {ticketTypes.map((type) => {
                      const active = ticketTypeId === type.id;
                      return (
                        <PressableScale key={type.id} onPress={() => setTicketTypeId(type.id)} accessibilityLabel={type.name} className={cn('h-9 justify-center rounded-full border px-3', active ? 'border-primary bg-primary dark:border-white dark:bg-white' : 'border-app-border dark:border-dark-border')}>
                          <AppText className={cn('font-gilroy-medium text-[12px]', active ? 'text-white dark:text-primary' : '')}>
                            {type.name} — {type.price}
                          </AppText>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
                <View className="flex-row items-end gap-2">
                  <GlassInput containerClassName="flex-1" label={`${t('Price')} (${currency})`} placeholder={t('Default')} value={priceOverride} keyboardType="decimal-pad" onChangeText={(next) => setPriceOverride(next.replace(',', '.'))} />
                  {priceOverride ? (
                    <PressableScale onPress={() => setPriceOverride('')} accessibilityLabel={t('Reset price')} className="h-12 w-12 items-center justify-center rounded-[10px] border border-app-border dark:border-dark-border">
                      <RotateCcw size={16} color={colors.muted} />
                    </PressableScale>
                  ) : null}
                </View>
                <GlassInput label={t('Comment')} placeholder={t('Optional note for this zone')} value={comment} onChangeText={setComment} />
                <View className="flex-row items-center justify-between rounded-[12px] border px-4 py-3" style={{ borderColor: cardBorder }}>
                  <AppText className="font-gilroy-semibold text-[14px]">{t('Active')}</AppText>
                  <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary, false: '#d1d1d6' }} thumbColor={colors.white} />
                </View>
              </View>
            </ScrollView>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <PressableScale onPress={onClose} accessibilityLabel={t('Cancel')} className="h-[52px] w-full items-center justify-center rounded-[12px] border border-app-border bg-white dark:border-dark-border dark:bg-dark-surface">
                  <AppText className="font-gilroy-semibold text-[16px]">{t('Cancel')}</AppText>
                </PressableScale>
              </View>
              <View className="flex-1">
                <PressableScale onPress={() => void save()} disabled={saving} accessibilityLabel={t('Save')} className="h-[52px] w-full items-center justify-center rounded-[12px] bg-primary dark:bg-white">
                  {saving ? <ActivityIndicator color={colors.muted} /> : <AppText className="font-gilroy-semibold text-[16px] text-white dark:text-primary">{t('Save')}</AppText>}
                </PressableScale>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost />
    </Modal>
  );
}

function ZoneRowSkeleton() {
  return (
    <View className="flex-row items-start gap-3 py-3">
      <Skeleton className="h-9 w-9 rounded-[9px]" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-1/2" />
        <View className="flex-row gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24 rounded-full" />
        </View>
      </View>
      <Skeleton className="h-5 w-16 rounded-full" />
    </View>
  );
}

export default function VenuePricingScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } = useSelectedEvent();
  const numericId = eventId ?? 0;
  const skip = eventId == null;

  const {
    data: eventVenues,
    isLoading: venuesLoading,
    isError: venuesError,
    refetch: refetchVenues,
  } = useGetEventVenuesQuery(numericId, { skip });
  const { data: eventZones, isLoading: zonesLoading, refetch: refetchZones } = useGetEventZonesQuery(numericId, { skip });
  const [createVenue] = useCreateVenueMutation();
  const [assignVenue] = useAssignVenueToEventMutation();
  const [deleteVenue] = useDeleteVenueMutation();

  const [mode, setMode] = useState<'zones' | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingZone, setEditingZone] = useState<VenueZone | null>(null);

  const currency = event?.currency ?? 'MDL';
  const eventVenue: EventVenue | null = eventVenues?.[0] ?? null;
  const seatMapSummary = event?.seat_map ?? event?.table_map ?? null;
  const isTableMap = !event?.seat_map && Boolean(event?.table_map);
  const hasVenue = Boolean(eventVenue) && eventVenue?.venue_details.template !== 'seat_map';

  const zones = useMemo(() => {
    if (!eventVenue) return [];
    return [...(eventVenue.venue_details.zones ?? [])].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  }, [eventVenue]);

  const zoneMap = useMemo(() => {
    const map = new Map<number, EventZone>();
    (eventZones ?? []).forEach((eventZone) => map.set(eventZone.zone, eventZone));
    return map;
  }, [eventZones]);

  const activeTicketTypes = useMemo(
    () => (event?.ticket_types ?? []).filter((type) => type.is_active !== false && type.is_archived !== true),
    [event?.ticket_types],
  );
  const totalCapacity = useMemo(() => zones.reduce((sum, zone) => sum + zone.capacity, 0), [zones]);
  const configuredCount = useMemo(() => zones.filter((zone) => zoneMap.has(zone.id)).length, [zones, zoneMap]);

  const isLoading = eventLoading || venuesLoading || zonesLoading;

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await Promise.all([refetchVenues(), refetchZones(), refetchEvent()]);
    } finally {
      setRefreshing(false);
    }
  };

  const pickTemplate = async (template: VenueTemplate) => {
    if (creating || eventId == null) return;
    haptics.light();
    setCreating(true);
    try {
      const venue = await createVenue({
        eventId,
        name: event?.title ?? 'Event venue',
        location: event?.region || event?.address || '',
        capacity: 0,
        template,
      }).unwrap();
      await assignVenue({ eventId, venueId: venue.id }).unwrap();
      haptics.success();
      toast(t('Template applied'), 'success');
      setMode(null);
    } catch (error) {
      haptics.error();
      const message = extractApiError(error);
      toast(message ? t(message) : t('Failed to assign venue'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const confirmResetTemplate = () => {
    if (!eventVenue || eventId == null) return;
    Alert.alert(t('Change template'), t('Reset template? This will delete all zone configuration for this event.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Change template'),
        style: 'destructive',
        onPress: () => {
          deleteVenue({ eventId, venueId: eventVenue.venue })
            .unwrap()
            .then(() => toast(t('Template removed'), 'success'))
            .catch(() => toast(t('Update failed'), 'error'));
        },
      },
    ]);
  };

  const renderZoneVenue = () =>
    eventVenue ? (
      <>
        <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-card-sm dark:bg-dark-elevated">
              <Building2 size={20} color={headerIconTint} />
            </View>
            <View className="flex-1">
              <AppText numberOfLines={1} className="font-gilroy-bold text-[16px]">
                {eventVenue.venue_details.name}
              </AppText>
              {eventVenue.venue_details.location ? (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <MapPin size={12} color={colors.muted} />
                  <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                    {eventVenue.venue_details.location}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${ACCENT_BLUE}18` }}>
              <AppText className="font-gilroy-semibold text-[11px]" style={{ color: ACCENT_BLUE }}>
                {templateLabel(eventVenue.venue_details.template, t)}
              </AppText>
            </View>
          </View>
          <View className="flex-row gap-2">
            <StatPill label={t('Total capacity')} value={String(totalCapacity)} />
            <StatPill label={t('Priced zones')} value={`${configuredCount}/${zones.length}`} />
          </View>
          {eventVenue.configuration_notes ? (
            <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{eventVenue.configuration_notes}</AppText>
          ) : null}
          <PressableScale onPress={confirmResetTemplate} accessibilityLabel={t('Change template')} className="h-10 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-app-border dark:border-dark-border">
            <LayoutGrid size={14} color={colors.muted} />
            <AppText className="font-gilroy-semibold text-[13px]">{t('Change template')}</AppText>
          </PressableScale>
        </View>

        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('Tap a zone to set its ticket type, price, capacity and colour.')}</AppText>

        <View className="gap-2">
          <AppText className="font-gilroy-semibold text-[13px] uppercase tracking-wide text-muted dark:text-dark-muted">
            {`${zones.length} ${zones.length === 1 ? t('Zone') : t('Zones')}`}
          </AppText>
          {zones.length > 0 ? (
            <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
              {zones.map((zone, index) => (
                <Pressable
                  key={zone.id}
                  onPress={() => {
                    haptics.selection();
                    setEditingZone(zone);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={zone.name}
                  className={cn('flex-row items-center gap-2', index > 0 && 'border-t')}
                  style={index > 0 ? { borderColor: rowDivider } : undefined}
                >
                  <View className="flex-1">
                    <ZoneRow zone={zone} mapping={zoneMap.get(zone.id) ?? null} currency={currency} t={t} />
                  </View>
                  <Pencil size={14} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <PressableScale onPress={() => void onRefresh()} accessibilityLabel={t('Try again')}>
              <View className="items-center gap-1 rounded-[12px] border bg-white px-4 py-8 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                <AppText className="font-gilroy-semibold text-[14px] text-muted dark:text-dark-muted">{t('This venue has no zones yet.')}</AppText>
              </View>
            </PressableScale>
          )}
        </View>

        {zones.length > 0 ? (
          <View className="gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
            <AppText className="font-gilroy-bold text-[16px]">{t('Live preview')}</AppText>
            {configuredCount < zones.length ? (
              <View className="rounded-[10px] px-3 py-2.5" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
                <AppText className="font-gilroy-medium text-[12px] leading-[17px]" style={{ color: '#b45309' }}>
                  {t('The arena will only appear publicly once every zone has a ticket type assigned. Unconfigured zones fall back to the regular ticket list.')}
                </AppText>
              </View>
            ) : null}
            <ArenaPreview zones={zones} mappings={zoneMap} currency={currency} />
          </View>
        ) : null}
      </>
    ) : null;

  const renderSetup = () =>
    mode === 'zones' ? (
      <View className="gap-3">
        <PressableScale onPress={() => setMode(null)} accessibilityLabel={t('Back to venue options')} className="self-start">
          <AppText className="font-gilroy-semibold text-[13px] text-links">{t('Back to venue options')}</AppText>
        </PressableScale>
        <AppText className="font-gilroy-bold text-[18px]">{t('Pick an arena template')}</AppText>
        <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('Choose a layout. You can customise zone names, colours, capacity, prices and comments after.')}</AppText>
        {TEMPLATES.map((template) => (
          <ChoiceCard key={template.id} title={t(template.label)} description={t(template.sub)} disabled={creating} onPress={() => void pickTemplate(template.id)} />
        ))}
        {creating ? <ActivityIndicator color={colors.muted} /> : null}
      </View>
    ) : (
      <View className="gap-3">
        <AppText className="font-gilroy-bold text-[18px]">{t('How should attendees pick their tickets?')}</AppText>
        <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('Choose a zone map with fixed templates, or a seat map where every seat is picked individually.')}</AppText>
        <ChoiceCard title={t('Zone map (template)')} description={t('Attendees pick a zone and a quantity. Best for arenas and general admission areas.')} disabled={creating} onPress={() => setMode('zones')} />
        <ChoiceCard title={t('Seat map (venue layout)')} description={t('Attendees pick numbered seats on a venue layout with live availability.')} disabled={creating} onPress={navigate.venuePricingSeatMap} />
      </View>
    );

  const renderBody = () => {
    if (isLoading) {
      return (
        <View className="gap-4">
          <Skeleton className="h-[120px] w-full rounded-[14px]" />
          <View className="rounded-[12px] border bg-white px-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
            {[0, 1, 2, 3].map((key) => (
              <View key={key} className={key > 0 ? 'border-t' : ''} style={key > 0 ? { borderColor: rowDivider } : undefined}>
                <ZoneRowSkeleton />
              </View>
            ))}
          </View>
        </View>
      );
    }
    if (eventError || !event) {
      return <EmptyState icon={Building2} title={t('Unable to load event data.')} actionLabel={t('Try again')} onAction={() => void refetchEvent()} />;
    }
    if (seatMapSummary) {
      return <SeatMapCard seatMap={seatMapSummary} tables={isTableMap} currency={currency} t={t} onConfigure={navigate.venuePricingSeatMap} />;
    }
    if (venuesError) {
      return <EmptyState icon={Building2} title={t('Failed to load venue configuration')} actionLabel={t('Try again')} onAction={() => void onRefresh()} />;
    }
    return hasVenue ? renderZoneVenue() : renderSetup();
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Venue & Pricing')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.muted} progressViewOffset={padding.top} />}
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">{t('Seated venue layout and zone pricing for this event.')}</AppText>
          {renderBody()}
        </View>
      </ScrollView>
      {editingZone && eventVenue && eventId != null ? (
        <ZoneEditSheet
          key={editingZone.id}
          eventId={eventId}
          eventVenueId={eventVenue.id}
          zone={editingZone}
          mapping={zoneMap.get(editingZone.id) ?? null}
          ticketTypes={activeTicketTypes}
          currency={currency}
          onClose={() => setEditingZone(null)}
        />
      ) : null}
    </Screen>
  );
}
