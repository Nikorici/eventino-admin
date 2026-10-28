import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ArrowLeftRight, CalendarDays, Download, FileText, Mail, MapPin, Pencil, X } from 'lucide-react-native';

import { AppText, PressableScale, Skeleton } from '@/components/ui';
import { CancelEventSheet } from '@/components/dashboard/CancelEventSheet';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ReleaseTicketSheet } from '@/components/dashboard/ReleaseTicketSheet';
import {
  ACCENT_GREEN,
  ACCENT_ORANGE,
  ACCENT_RED,
  HeaderAction,
  PDF_SHARE,
  ROW_DIVIDER,
  useFileAction,
} from '@/components/dashboard/dashboardParts';
import { BlurredPoster } from '@/components/events/BlurredPoster';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { eventEndpoint } from '@/lib/constants';
import { downloadAuthedFile } from '@/lib/downloads';
import { getEventTimeStatus } from '@/lib/eventStatus';
import { dateFnsLocale, eventCurrencyCode, parseEventDate } from '@/lib/format';
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

function HeaderField({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <View className="flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <Icon size={13} color={colors.muted} />
        <AppText className="font-gilroy-medium text-[12px] text-muted">{label}</AppText>
      </View>
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
        {value}
      </AppText>
    </View>
  );
}

export function EventHeaderCard({ event }: { event: EventDetail }) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const rowDivider = useThemeColor(ROW_DIVIDER, colors.dark.border);
  const status = eventStatus(event, t);
  const start = parseEventDate(event.start_date);
  const dateText = start ? format(start, 'd MMM yyyy', { locale: dateFnsLocale(i18n.language) }) : '-';

  return (
    <View className="overflow-hidden rounded-[12px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="relative aspect-[312/150] w-full">
        <BlurredPoster uri={event.images?.[0] ?? null} className="h-full w-full" iconSize={32} recyclingKey={String(event.id)} />
        {status ? (
          <View style={{ backgroundColor: status.color }} className="absolute left-3 top-3 rounded-full px-2.5 py-1">
            <AppText className="font-gilroy-bold text-[10px] uppercase tracking-wide text-white dark:text-white">
              {status.label}
            </AppText>
          </View>
        ) : null}
        <View className="absolute right-3 top-3">
          <PressableScale
            onPress={navigate.selectEvent}
            accessibilityLabel={t('Change event')}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/90"
          >
            <ArrowLeftRight size={16} color={colors.primary} />
          </PressableScale>
        </View>
      </View>
      <View className="gap-1 px-4 pb-4 pt-3">
        <AppText className="font-gilroy-bold text-[20px] leading-[25px]">{event.title}</AppText>
        <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Here is the information about your event')}</AppText>
        <View className="mt-2 flex-row gap-3 border-t pt-3" style={{ borderColor: rowDivider }}>
          <HeaderField icon={MapPin} label={t('Location:')} value={event.country || '-'} />
          <HeaderField icon={CalendarDays} label={t('Date:')} value={dateText} />
        </View>
      </View>
    </View>
  );
}

export function EventHeaderCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="overflow-hidden rounded-[12px] border bg-white dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
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

  return (
    <View className="gap-2.5">
      {showButtons ? (
        <>
          <View className="flex-row gap-2.5">
            {permissions.hasFullAccess ? (
              <HeaderAction icon={Pencil} label={t('Edit event')} onPress={navigate.editEvent} variant="outline" />
            ) : null}
            <HeaderAction icon={Mail} label={t('Release Ticket')} onPress={() => setReleaseOpen(true)} />
          </View>
          <View className="flex-row gap-2.5">
            <HeaderAction
              icon={Download}
              label={t('Settlement PDF')}
              onPress={() => void onSettlement()}
              loading={busyKey === 'settlement'}
              variant="outline"
            />
            <HeaderAction
              icon={FileText}
              label={t('Handover document')}
              onPress={() => void onActPredare()}
              loading={busyKey === 'act'}
              variant="outline"
            />
          </View>
        </>
      ) : null}
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
