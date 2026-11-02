import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, CalendarDays, CirclePlay, Download, FileText, Mail, MapPin, Pencil, X } from 'lucide-react-native';

import { AppText, Chip, PressableScale, Skeleton } from '@/components/ui';
import { CancelEventSheet } from '@/components/dashboard/CancelEventSheet';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ReleaseTicketSheet } from '@/components/dashboard/ReleaseTicketSheet';
import {
  ACCENT_GREEN,
  ACCENT_ORANGE,
  ACCENT_RED,
  HeaderAction,
  PDF_SHARE,
  useFileAction,
} from '@/components/dashboard/dashboardParts';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { eventEndpoint } from '@/lib/constants';
import { downloadAuthedFile } from '@/lib/downloads';
import { getEventTimeStatus } from '@/lib/eventStatus';
import { eventCurrencyCode, formatEventDay, formatEventStartTime, locationLine } from '@/lib/format';
import { navigate } from '@/lib/nav';
import type { EventPermissions } from '@/lib/sections';
import type { EventDetail } from '@/types/api';
import { colors } from '@/theme/colors';

function eventStatus(event: EventDetail, t: (key: string) => string): { label: string; color: string } | null {
  if (event.is_cancelled) return { label: t('Cancelled'), color: ACCENT_RED };
  if (event.in_draft) return { label: t('Draft'), color: '#8e8e93' };
  switch (getEventTimeStatus(event)) {
    case 'live':
      return { label: t('Live'), color: ACCENT_GREEN };
    case 'today':
      return { label: t('Today'), color: '#f97316' };
    case 'finished':
      return { label: t('Finished'), color: ACCENT_RED };
    case 'upcoming':
      return { label: t('Upcoming'), color: ACCENT_ORANGE };
    default:
      return null;
  }
}

function eventDateLine(event: EventDetail, lang: string): string {
  const start = formatEventDay(event.start_date, lang);
  const end = formatEventDay(event.end_date, lang);
  const days = start && end && end !== start ? `${start} — ${end}` : start;
  const time = formatEventStartTime(event);
  return [days, time].filter(Boolean).join(' · ') || '-';
}

export function EventHeaderCard({ event, onStartTour }: { event: EventDetail; onStartTour?: () => void }) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const swapIcon = useThemeColor(colors.primary, colors.dark.text);
  const tourIcon = useThemeColor(colors.primary, colors.dark.text);
  const status = eventStatus(event, t);

  return (
    <View className="overflow-hidden rounded-[14px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="relative aspect-[312/150] w-full">
        <BlurredPoster uri={event.images?.[0] ?? null} className="h-full w-full" iconSize={32} recyclingKey={String(event.id)} />
        {status ? (
          <View style={{ backgroundColor: status.color }} className="absolute left-3 top-3 h-[22px] justify-center rounded-full px-2.5">
            <AppText className="font-gilroy-bold text-[10px] uppercase tracking-[0.5px] text-white dark:text-white">
              {status.label}
            </AppText>
          </View>
        ) : null}
        <View className="absolute right-3 top-3">
          <PressableScale
            onPress={navigate.selectEvent}
            accessibilityLabel={t('Change event')}
            className="h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/85 dark:border-white/[0.12] dark:bg-[rgba(31,38,43,0.85)]"
          >
            <ArrowLeftRight size={16} color={swapIcon} />
          </PressableScale>
        </View>
      </View>
      <View className="gap-1.5 p-4">
        <AppText className="font-gilroy-bold text-[24px] leading-[30px]">{event.title}</AppText>
        <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
          {t('Here is the information about your event')}
        </AppText>
        <View className="mt-1 flex-row items-center gap-1.5">
          <MapPin size={15} color={colors.muted} />
          <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
            {locationLine(event)}
          </AppText>
        </View>
        <View className="flex-row items-center gap-1.5">
          <CalendarDays size={15} color={colors.muted} />
          <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[14px] leading-[19px] text-muted dark:text-dark-muted">
            {eventDateLine(event, i18n.language)}
          </AppText>
        </View>
        {onStartTour ? (
          <View className="mt-2 flex-row">
            <Chip label={t('eventTourStart')} icon={<CirclePlay size={16} color={tourIcon} />} onPress={onStartTour} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function EventHeaderCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="overflow-hidden rounded-[14px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <Skeleton className="aspect-[312/150] w-full rounded-none" />
      <View className="gap-2 px-4 pb-4 pt-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <View className="mt-2 flex-row gap-3">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </View>
      </View>
    </View>
  );
}

export function EventActions({
  event,
  permissions,
  isStaffUser,
}: {
  event: EventDetail;
  permissions: EventPermissions;
  isStaffUser: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { busyKey, run } = useFileAction();
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const showButtons = permissions.isEventOwner || isStaffUser || permissions.canManageTickets;

  if (!showButtons) return null;

  const onSettlement = () =>
    run(
      'settlement',
      (token) => downloadAuthedFile(eventEndpoint.eventSettlementPdf(event.id), token, `decont_eveniment_${event.id}.pdf`),
      { ...PDF_SHARE, dialogTitle: t('Settlement PDF') },
      {
        success: t('Settlement report downloaded successfully'),
        error: t('Failed to download settlement report'),
      },
    );

  const onActPredare = () =>
    run(
      'act',
      (token) => downloadAuthedFile(eventEndpoint.actPredarePdf(event.id), token, `act_predare_primire_${event.id}.pdf`),
      { ...PDF_SHARE, dialogTitle: t('Handover document') },
      {
        success: t('Act predare-primire downloaded successfully'),
        error: t('Failed to download act predare-primire'),
      },
    );

  const onCancelPress = () => {
    if (event.is_cancelled) {
      toast(t('Your event has been cancelled. Buyers will receive their refunds within 3–5 days.'), 'info');
      return;
    }
    setCancelOpen(true);
  };

  const actions = [
    ...(permissions.hasFullAccess
      ? [<HeaderAction key="edit" icon={Pencil} label={t('Edit event')} onPress={navigate.editEvent} variant="outline" />]
      : []),
    <HeaderAction
      key="settlement"
      icon={Download}
      label={t('Settlement PDF')}
      onPress={() => void onSettlement()}
      loading={busyKey === 'settlement'}
      variant="outline"
    />,
    <HeaderAction
      key="act"
      icon={FileText}
      label={t('Handover document')}
      onPress={() => void onActPredare()}
      loading={busyKey === 'act'}
      variant="outline"
    />,
    <HeaderAction key="release" icon={Mail} label={t('Send free ticket')} onPress={() => setReleaseOpen(true)} />,
  ];
  const actionRows = [actions.slice(0, 2), actions.slice(2)].filter((row) => row.length > 0);

  return (
    <View className="gap-2.5">
      {actionRows.map((row) => (
        <View key={row.map((action) => action.key).join('-')} className="flex-row gap-2.5">
          {row}
        </View>
      ))}
      {isStaffUser ? (
        <View className="flex-row">
          <HeaderAction
            icon={X}
            label={event.is_cancelled ? t('Event cancelled') : t('Cancel Event')}
            onPress={onCancelPress}
            variant="danger"
          />
        </View>
      ) : null}

      <ReleaseTicketSheet
        visible={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        eventId={event.id}
        ticketTypes={event.ticket_types ?? []}
        venues={event.venues ?? []}
        seated={event.seat_map?.status === 'active'}
        currency={eventCurrencyCode(event)}
      />
      {cancelOpen ? (
        <CancelEventSheet
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => setCancelOpen(false)}
        />
      ) : null}
    </View>
  );
}
