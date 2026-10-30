import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { FlashList } from '@shopify/flash-list';
import * as WebBrowser from 'expo-web-browser';
import RNEventSource from 'react-native-sse';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Lock, Printer, Sticker, X } from 'lucide-react-native';
import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ToggleRow } from '@/components/printing/printingParts';
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
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { API_URL, USE_MOCKS } from '@/lib/constants';
import { downloadAuthedFilePost, shareFile } from '@/lib/downloads';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { getAccessToken } from '@/lib/storage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  SPECIAL_STICKER_EVENT_ID,
  STICKER_SIZES,
  stickerEndpoints,
  stickersApi,
  useGetScannedTicketsQuery,
  useLazyGetStickerNetworkingProfileQuery,
  type GenerateStickerBody,
  type ScannedTicket,
  type StickerSize,
} from '@/store/api/stickersApi';
import { colors } from '@/theme/colors';

const SIZE_LABELS: Record<StickerSize, string> = {
  '58x80': '58 × 80 mm',
  '50x30': '50 × 30 mm',
};

const RECONNECT_MS = 5000;

function sanitizeFilename(text: string): string {
  const cleaned = text
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  return cleaned || 'attendee';
}

function formatScanDate(value: string, lang: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return format(parsed, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) });
}

function isAccessDenied(error: FetchBaseQueryError | SerializedError | undefined): boolean {
  if (!error || !('status' in error)) return false;
  return error.status === 403 || error.status === 401;
}

const textOf = (value: unknown) => (typeof value === 'string' ? value : '');

function parseScannedTicket(data: string | null): ScannedTicket | null {
  if (!data) return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed) || parsed.type !== 'ticket_scanned') return null;
    if (!('ticket' in parsed) || typeof parsed.ticket !== 'object' || parsed.ticket === null) return null;
    const row: Record<string, unknown> = { ...parsed.ticket };
    if (typeof row.uuid !== 'string') return null;
    return {
      uuid: row.uuid,
      attendee_name: textOf(row.attendee_name),
      company: typeof row.company === 'string' ? row.company : null,
      ticket_type: textOf(row.ticket_type),
      event_id: Number(row.event_id),
      event_title: textOf(row.event_title),
      scan_date: textOf(row.scan_date),
      user_id: typeof row.user_id === 'number' ? row.user_id : null,
    };
  } catch {
    return null;
  }
}

function useStickerNotifications(userId: number | undefined) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (USE_MOCKS || userId == null) return undefined;
    let closed = false;
    let source: RNEventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (closed) return;
      const next = new RNEventSource(`${API_URL}/api/v1/tickets/stream/sticker-notifications/?user_id=${userId}`, { pollingInterval: 0 });
      source = next;
      next.addEventListener('message', (event) => {
        const ticket = parseScannedTicket(event.data);
        if (!ticket) return;
        dispatch(
          stickersApi.util.updateQueryData('getScannedTickets', 1, (draft) => {
            if (!draft.results.some((row) => row.uuid === ticket.uuid)) draft.results.unshift(ticket);
          }),
        );
      });
      next.addEventListener('error', () => {
        next.removeAllEventListeners();
        next.close();
        if (!closed) timer = setTimeout(connect, RECONNECT_MS);
      });
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      source?.removeAllEventListeners();
      source?.close();
    };
  }, [dispatch, userId]);
}

const keyExtractor = (item: ScannedTicket) => item.uuid;

const ItemSeparator = () => <View className="h-2.5" />;

function ScannedTicketCard({ ticket, onGenerate }: { ticket: ScannedTicket; onGenerate: () => void }) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const buttonTint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="gap-0.5">
        <AppText numberOfLines={1} className="font-gilroy-bold text-[16px]">
          {ticket.attendee_name || t('Attendee')}
        </AppText>
        <AppText numberOfLines={1} className="font-gilroy-medium text-[13px] text-muted">
          {ticket.event_title}
          {ticket.ticket_type ? ` · ${ticket.ticket_type}` : ''}
        </AppText>
        <AppText className="font-gilroy-medium text-[12px] text-muted">{formatScanDate(ticket.scan_date, i18n.language)}</AppText>
      </View>
      <PressableScale
        onPress={onGenerate}
        accessibilityLabel={t('Print sticker')}
        className="h-11 flex-row items-center justify-center gap-2 rounded-[12px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
      >
        <Printer size={16} color={buttonTint} />
        <AppText className="font-gilroy-semibold text-[14px]">{t('Print sticker')}</AppText>
      </PressableScale>
    </View>
  );
}

function TicketCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-3 w-28" />
      </View>
      <Skeleton className="h-11 w-full rounded-[12px]" />
    </View>
  );
}

function StickerSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
          <Pressable className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg" onPress={(event) => event.stopPropagation()}>
            <View className="mb-4 flex-row items-center justify-between">
              <AppText numberOfLines={1} className="flex-1 pr-3 font-gilroy-bold text-[20px]">
                {title}
              </AppText>
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

function DefaultHint({ value }: { value: string | null | undefined }) {
  const { t } = useTranslation();
  if (!value) return null;
  return (
    <AppText className="font-gilroy-medium text-[12px] text-muted">
      {t('Default')}: {value}
    </AppText>
  );
}

function StickerConfigForm({ ticket, onClose }: { ticket: ScannedTicket; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const submitTint = useThemeColor(colors.white, colors.primary);
  const [fetchProfile] = useLazyGetStickerNetworkingProfileQuery();

  const [name, setName] = useState(ticket.attendee_name ?? '');
  const [company, setCompany] = useState(ticket.company ?? '');
  const [companyEdited, setCompanyEdited] = useState(false);
  const [showTicketType, setShowTicketType] = useState(true);
  const [size, setSize] = useState<StickerSize>('58x80');
  const [generating, setGenerating] = useState(false);

  const specialLayout = ticket.event_id === SPECIAL_STICKER_EVENT_ID;
  const hideCompany = specialLayout && showTicketType;

  const onSubmit = useCallback(async () => {
    if (generating) return;
    haptics.selection();
    setGenerating(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast(t('You must be logged in for this action.'), 'error');
        return;
      }
      let stickerCompany = hideCompany ? '' : company.trim();
      if (!hideCompany && !stickerCompany && !companyEdited && ticket.user_id) {
        const profile = await fetchProfile(ticket.user_id)
          .unwrap()
          .catch(() => null);
        stickerCompany = profile?.company ?? '';
      }
      const attendeeName = name.trim() || ticket.attendee_name;
      const body: GenerateStickerBody = {
        ticket_uuid: ticket.uuid,
        attendee_name: attendeeName,
        company: stickerCompany,
        size,
        show_ticket_type: showTicketType,
      };
      const filename = `sticker_${sanitizeFilename(attendeeName || 'attendee')}_${size}.pdf`;
      const uri = await downloadAuthedFilePost(stickerEndpoints.generate, token, body, filename);
      const shared = await shareFile(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('Print sticker') });
      if (!shared) await WebBrowser.openBrowserAsync(uri);
      onClose();
    } catch {
      toast(t('Failed to generate sticker'), 'error');
    } finally {
      setGenerating(false);
    }
  }, [generating, name, ticket, hideCompany, company, companyEdited, size, showTicketType, toast, t, onClose, fetchProfile]);

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <AppText className="font-gilroy-semibold text-[13px] text-muted">{t('Name')}</AppText>
        <GlassInput placeholder={t('Attendee name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <DefaultHint value={ticket.attendee_name} />
      </View>

      <View className="rounded-[12px] border border-app-border bg-white px-4 py-2.5 dark:border-dark-border dark:bg-dark-surface">
        <ToggleRow label={t('Show ticket type')} value={showTicketType} onChange={setShowTicketType} />
      </View>

      {!hideCompany ? (
        <View className="gap-1.5">
          <AppText className="font-gilroy-semibold text-[13px] text-muted">{t('Company')}</AppText>
          <GlassInput
            placeholder={t('Company name (optional)')}
            value={company}
            onChangeText={(value) => {
              setCompanyEdited(true);
              setCompany(value);
            }}
            autoCapitalize="words"
          />
          <DefaultHint value={ticket.company} />
        </View>
      ) : null}

      <View className="gap-1.5">
        <AppText className="font-gilroy-semibold text-[13px] text-muted">{t('Sticker size')}</AppText>
        <SegmentedControl<StickerSize>
          value={size}
          onChange={setSize}
          options={STICKER_SIZES.map((value) => ({ value, label: SIZE_LABELS[value] }))}
        />
      </View>

      <PressableScale
        onPress={() => {
          void onSubmit();
        }}
        disabled={generating}
        accessibilityLabel={t('Print sticker')}
        className={cn(
          'mt-1 h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white',
          generating && 'opacity-60',
        )}
      >
        {generating ? (
          <ActivityIndicator color={submitTint} />
        ) : (
          <>
            <Printer size={18} color={submitTint} />
            <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">{t('Print sticker')}</AppText>
          </>
        )}
      </PressableScale>
    </View>
  );
}

export default function StickersScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const spinnerColor = useThemeColor('#2b3a44', '#f9f9f9');
  const userId = useAppSelector((state) => state.auth.user?.id);

  const [page, setPage] = useState(1);
  const [activeTicket, setActiveTicket] = useState<ScannedTicket | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useGetScannedTicketsQuery(page);
  useStickerNotifications(userId);

  const accessDenied = isError && isAccessDenied(error);
  const tickets = data?.results ?? [];

  const onRefresh = useCallback(() => {
    haptics.selection();
    if (page !== 1) setPage(1);
    else void refetch();
  }, [page, refetch]);

  const onEndReached = useCallback(() => {
    if (data?.has_more && !isFetching) setPage((prev) => prev + 1);
  }, [data?.has_more, isFetching]);

  if (accessDenied) {
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Stickers')} onBack={navigate.back} />
        <View style={{ paddingTop: padding.top }} className="flex-1 items-center justify-center">
          <EmptyState icon={Lock} title={t('Access denied')} message={t('You can view stickers only if you are staff or an event scanner.')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Stickers')} onBack={navigate.back} />
      <FlashList
        data={tickets}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <ScannedTicketCard ticket={item} onGenerate={() => setActiveTicket(item)} />}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <AppText className="pb-4 font-gilroy-medium text-[14px] text-muted">
            {t('Print name stickers for attendees as their tickets are scanned.')}
          </AppText>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="gap-2.5">
              <TicketCardSkeleton />
              <TicketCardSkeleton />
              <TicketCardSkeleton />
            </View>
          ) : isError ? (
            <EmptyState
              icon={Sticker}
              title={t('Something went wrong.')}
              message={t('Please try again.')}
              actionLabel={t('Try again')}
              onAction={() => void refetch()}
            />
          ) : (
            <EmptyState icon={Sticker} title={t('No tickets scanned yet')} message={t('Scan a ticket to see stickers appear here.')} />
          )
        }
        ListFooterComponent={
          isFetching && page > 1 ? (
            <View className="items-center py-6">
              <ActivityIndicator color={spinnerColor} />
            </View>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && page === 1 && !isLoading}
            onRefresh={onRefresh}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      />

      <StickerSheet visible={activeTicket != null} title={t('Print sticker')} onClose={() => setActiveTicket(null)}>
        {activeTicket ? <StickerConfigForm key={activeTicket.uuid} ticket={activeTicket} onClose={() => setActiveTicket(null)} /> : null}
      </StickerSheet>
    </Screen>
  );
}
