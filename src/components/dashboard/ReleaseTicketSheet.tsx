import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Check, Mail, Minus, Plus, X } from 'lucide-react-native';

import { AppText, GlassInput, PressableScale, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ReleaseSeatPicker } from '@/components/seatmap/ReleaseSeatPicker';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { buildReleasePayload, releaseRowSeatError, validatePhone, zonesForTicketType } from '@/lib/ticketRelease';
import { useReleaseManualTicketMutation } from '@/store/api/organizerApi';
import type { ArenaVenue, ArenaZone, TicketType } from '@/types/api';
import { colors } from '@/theme/colors';

const MAX_QUANTITY = 1000;

interface ReleaseRow {
  ticketTypeId: number;
  quantity: number;
  zoneId: number | null;
  seatIds: number[];
}

export interface ReleaseTicketSheetProps {
  visible: boolean;
  onClose: () => void;
  eventId: number;
  ticketTypes: TicketType[];
  venues: ArenaVenue[];
  seated: boolean;
  currency: string;
}

function priceOf(type: TicketType): number {
  const value = Number(type.price);
  return Number.isFinite(value) ? value : 0;
}

function InfoNote({ text }: { text: string }) {
  return (
    <View className="rounded-[12px] bg-black/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
      <AppText className="font-gilroy-medium text-[12px] leading-[17px] text-muted dark:text-dark-muted">{text}</AppText>
    </View>
  );
}

export function ReleaseTicketSheet({
  visible,
  onClose,
  eventId,
  ticketTypes,
  venues,
  seated,
  currency,
}: ReleaseTicketSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { height: windowHeight } = useWindowDimensions();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const submitTint = useThemeColor(colors.white, colors.primary);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [release, { isLoading }] = useReleaseManualTicketMutation();

  const sortedTypes = useMemo(() => [...ticketTypes].sort((a, b) => priceOf(a) - priceOf(b)), [ticketTypes]);
  const hasZones = !seated && venues.some((venue) => (venue.zones ?? []).some((zone) => zone.is_active !== false));

  useEffect(() => {
    if (!visible) return;
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRows([]);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setRows((current) => {
      if (current.length > 0) return current;
      const first = sortedTypes[0];
      return first ? [{ ticketTypeId: first.id, quantity: 1, zoneId: null, seatIds: [] }] : current;
    });
  }, [visible, sortedTypes]);

  const toggleTicketType = useCallback((id: number) => {
    void haptics.selection();
    setRows((current) =>
      current.some((row) => row.ticketTypeId === id)
        ? current.filter((row) => row.ticketTypeId !== id)
        : [...current, { ticketTypeId: id, quantity: 1, zoneId: null, seatIds: [] }],
    );
  }, []);

  const changeRowQuantity = useCallback((id: number, delta: number) => {
    setRows((current) =>
      current.map((row) => {
        if (row.ticketTypeId !== id) return row;
        const quantity = Math.min(MAX_QUANTITY, Math.max(1, row.quantity + delta));
        return { ...row, quantity, seatIds: row.seatIds.slice(0, quantity) };
      }),
    );
  }, []);

  const setRowZone = useCallback((id: number, zoneId: number) => {
    void haptics.selection();
    setRows((current) => current.map((row) => (row.ticketTypeId === id ? { ...row, zoneId } : row)));
  }, []);

  const setRowSeats = useCallback((id: number, seatIds: number[]) => {
    setRows((current) => current.map((row) => (row.ticketTypeId === id ? { ...row, seatIds } : row)));
  }, []);

  const zoneLabel = (zone: ArenaZone) =>
    zone.is_full
      ? t('{{name}} (full)', { name: zone.name })
      : t('{{name}} ({{available}} left)', {
          name: zone.name,
          available: zone.available_capacity,
        });

  const onSubmit = useCallback(async () => {
    if (!firstName.trim()) return toast(t('First name is required'), 'error');
    if (!lastName.trim()) return toast(t('Last name is required'), 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast(t('Please enter a valid email address'), 'error');
    if (phone.trim() && !validatePhone(phone.trim())) return toast(t('Please enter a valid phone number'), 'error');
    if (rows.length === 0) return toast(t('Please select a ticket type'), 'error');
    if (!seated && rows.some((row) => zonesForTicketType(venues, row.ticketTypeId).length > 0 && row.zoneId == null)) {
      return toast(t('Please select a zone for each ticket type'), 'error');
    }
    const seatMismatch = rows.map((row) => releaseRowSeatError(row, seated)).find((item) => item != null);
    if (seatMismatch)
      return toast(
        t('Pick exactly {{count}} seats for each ticket type', {
          count: seatMismatch.expected,
        }),
        'error',
      );

    const attendee = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    const failed: ReleaseRow[] = [];
    for (const row of rows) {
      try {
        await release({
          eventId,
          ...buildReleasePayload(attendee, row, seated),
        }).unwrap();
      } catch {
        failed.push(row);
      }
    }

    if (failed.length === 0) {
      void haptics.success();
      toast(t('Ticket released successfully! Email with tickets has been sent to the attendee.'), 'success');
      onClose();
      return;
    }
    setRows(failed);
    if (failed.length === rows.length) return toast(t('Failed to release ticket. Please try again.'), 'error');
    toast(
      t('Released {{ok}} of {{total}} ticket types. Failed: {{names}}', {
        ok: rows.length - failed.length,
        total: rows.length,
        names: failed.map((row) => sortedTypes.find((type) => type.id === row.ticketTypeId)?.name ?? '').join(', '),
      }),
      'error',
    );
  }, [firstName, lastName, email, phone, rows, seated, venues, eventId, release, toast, t, onClose, sortedTypes]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg" style={{ maxHeight: windowHeight * 0.88 }}>
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="flex-1 pr-3 font-gilroy-bold text-[20px]">{t('Release Ticket Manually')}</AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-3">
                <InfoNote
                  text={t(
                    'Complete the form to release a ticket to a specific attendee. An email with ticket information will be sent automatically.',
                  )}
                />
                {seated ? (
                  <InfoNote
                    text={t(
                      'This event uses a seat map, so pick the exact seats for every ticket. The seat is printed on the ticket and included in the email.',
                    )}
                  />
                ) : null}
                {hasZones ? (
                  <InfoNote
                    text={t(
                      'This event has a seating map, so every ticket must be released into a zone. The zone is printed on the ticket and included in the email so the attendee knows where to go.',
                    )}
                  />
                ) : null}

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <GlassInput
                      label={`${t('First Name')}*`}
                      placeholder={t('Enter first name')}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                  <View className="flex-1">
                    <GlassInput
                      label={`${t('Last Name')}*`}
                      placeholder={t('Enter last name')}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <GlassInput
                  label={`${t('Email')}*`}
                  placeholder={t('Enter email')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <GlassInput
                  label={`${t('Phone Number')} (${t('optional')})`}
                  placeholder={t('Enter phone number')}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />

                <AppText className="mt-1 font-gilroy-semibold text-[14px]">{`${t('Ticket Type')}*`}</AppText>
                {sortedTypes.length === 0 ? (
                  <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No ticket types available')}</AppText>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {sortedTypes.map((type) => {
                      const active = rows.some((row) => row.ticketTypeId === type.id);
                      const price = priceOf(type);
                      const label = price > 0 ? `${type.name} (${price} ${currency})` : `${type.name} ${t('(Free)')}`;
                      return (
                        <PressableScale
                          key={type.id}
                          onPress={() => toggleTicketType(type.id)}
                          accessibilityLabel={label}
                          className={cn(
                            'h-10 flex-row items-center justify-center gap-1.5 rounded-full border px-4',
                            active
                              ? 'border-primary bg-primary dark:border-white dark:bg-white'
                              : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
                          )}
                        >
                          {active ? <Check size={14} color={submitTint} /> : null}
                          <AppText
                            className={cn(
                              'font-gilroy-medium text-[13px]',
                              active ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text',
                            )}
                          >
                            {label}
                          </AppText>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}

                {rows.map((row) => {
                  const type = sortedTypes.find((item) => item.id === row.ticketTypeId);
                  if (!type) return null;
                  const zones = seated ? [] : zonesForTicketType(venues, row.ticketTypeId);
                  return (
                    <View key={row.ticketTypeId} className="gap-3 rounded-[14px] border p-3" style={{ borderColor: cardBorder }}>
                      <View className="flex-row items-center justify-between gap-3">
                        <AppText className="flex-1 font-gilroy-semibold text-[14px]" numberOfLines={1}>
                          {type.name}
                        </AppText>
                        <PressableScale
                          onPress={() => toggleTicketType(type.id)}
                          accessibilityLabel={t('Remove')}
                          className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
                        >
                          <X size={16} color={colors.muted} />
                        </PressableScale>
                      </View>
                      <View className="flex-row items-center gap-4">
                        <AppText className="flex-1 font-gilroy-medium text-[13px] text-muted">{t('Quantity')}</AppText>
                        <PressableScale
                          onPress={() => changeRowQuantity(type.id, -1)}
                          accessibilityLabel={t('Decrease')}
                          className="h-11 w-11 items-center justify-center rounded-full border"
                          style={{ borderColor: cardBorder }}
                        >
                          <Minus size={18} color={colors.muted} />
                        </PressableScale>
                        <AppText className="w-10 text-center font-gilroy-bold text-[18px]">{row.quantity}</AppText>
                        <PressableScale
                          onPress={() => changeRowQuantity(type.id, 1)}
                          accessibilityLabel={t('Increase')}
                          className="h-11 w-11 items-center justify-center rounded-full border"
                          style={{ borderColor: cardBorder }}
                        >
                          <Plus size={18} color={colors.muted} />
                        </PressableScale>
                      </View>
                      {zones.length > 0 ? (
                        <View className="gap-2">
                          <AppText className="font-gilroy-semibold text-[13px]">{`${t('Zone')}*`}</AppText>
                          <View className="flex-row flex-wrap gap-2">
                            {zones.map((zone) => {
                              const active = row.zoneId === zone.zone_id;
                              return (
                                <PressableScale
                                  key={zone.zone_id}
                                  onPress={() => setRowZone(type.id, zone.zone_id)}
                                  disabled={zone.is_full}
                                  accessibilityLabel={zoneLabel(zone)}
                                  className={cn(
                                    'h-9 flex-row items-center justify-center rounded-full border px-3',
                                    active
                                      ? 'border-primary bg-primary dark:border-white dark:bg-white'
                                      : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
                                    zone.is_full && 'opacity-40',
                                  )}
                                >
                                  <AppText
                                    className={cn(
                                      'font-gilroy-medium text-[12px]',
                                      active ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text',
                                    )}
                                  >
                                    {zoneLabel(zone)}
                                  </AppText>
                                </PressableScale>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {seated ? (
                        <ReleaseSeatPicker
                          eventId={eventId}
                          ticketTypeId={type.id}
                          quantity={row.quantity}
                          value={row.seatIds}
                          currency={currency}
                          onChange={(seatIds) => setRowSeats(type.id, seatIds)}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <PressableScale
              onPress={() => void onSubmit()}
              disabled={isLoading}
              accessibilityLabel={t('Release Ticket')}
              className="mt-5 h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white"
            >
              {isLoading ? (
                <ActivityIndicator color={submitTint} />
              ) : (
                <>
                  <Mail size={18} color={submitTint} />
                  <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">{t('Release Ticket')}</AppText>
                </>
              )}
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost />
    </Modal>
  );
}
