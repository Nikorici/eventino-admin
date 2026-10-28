import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Send, X } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import {
  ACCENT_GREEN,
  ACCENT_RED,
  Avatar,
  ListSkeleton,
  PanelCard,
  PanelError,
  PanelMessage,
  Pill,
  RowDivider,
  SectionTitle,
  SmallAction,
  confirmAction,
  formatDateTimeLabel,
  personName,
} from '@/components/dashboard/dashboardParts';
import { useToast } from '@/hooks/useToast';
import { haptics } from '@/lib/haptics';
import {
  useGetFreeTicketRequestsQuery,
  useRejectFreeTicketMutation,
  useSendFreeTicketMutation,
  type FreeTicketRequest,
} from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

function requestId(request: FreeTicketRequest): number {
  return request.id ?? request.order_id;
}

function RequestRow({
  request,
  busy,
  onSend,
  onReject,
}: {
  request: FreeTicketRequest;
  busy: 'send' | 'reject' | null;
  onSend: () => void;
  onReject: () => void;
}) {
  const { t, i18n } = useTranslation();
  const name = request.name?.trim() || personName(request, t('Unknown'));
  return (
    <View className="gap-2 py-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={name} />
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {name}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
            {request.email || '-'}
          </AppText>
        </View>
      </View>
      <View className="gap-1.5 pl-[52px]">
        <AppText className="font-gilroy-medium text-[12px] text-muted">
          {`${t('Submission date')}: ${formatDateTimeLabel(request.submission_date, i18n.language)}`}
        </AppText>
        <AppText className="font-gilroy-medium text-[12px] text-muted">{`${t('Coupon code')}: ${request.coupon_code || '-'}`}</AppText>
        {(request.tickets ?? []).length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {(request.tickets ?? []).map((ticket, index) => (
              <Pill key={`${ticket}-${index}`} label={ticket} color={colors.primaryLight} />
            ))}
          </View>
        ) : null}
        <View className="mt-1 flex-row gap-2">
          <SmallAction
            icon={Send}
            label={busy === 'send' ? t('Sending...') : t('Send Ticket')}
            onPress={onSend}
            loading={busy === 'send'}
            color={ACCENT_GREEN}
          />
          <SmallAction
            icon={X}
            label={busy === 'reject' ? t('Rejecting...') : t('Reject')}
            onPress={onReject}
            loading={busy === 'reject'}
            color={ACCENT_RED}
          />
        </View>
      </View>
    </View>
  );
}

export function FreeTicketRequestsPanel({ eventId, refreshSignal }: { eventId: number; refreshSignal: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState<{
    id: number;
    action: 'send' | 'reject';
  } | null>(null);
  const query = useGetFreeTicketRequestsQuery(eventId, {
    refetchOnMountOrArgChange: true,
  });
  const { refetch } = query;
  const [sendFreeTicket] = useSendFreeTicketMutation();
  const [rejectFreeTicket] = useRejectFreeTicketMutation();

  useEffect(() => {
    if (refreshSignal > 0) void refetch();
  }, [refreshSignal, refetch]);

  const perform = async (id: number, action: 'send' | 'reject') => {
    setBusy({ id, action });
    try {
      await (action === 'send' ? sendFreeTicket(id) : rejectFreeTicket(id)).unwrap();
      void haptics.success();
      if (action === 'send')
        toast(t('Ticket released successfully! Email with tickets has been sent to the attendee.'), 'success');
    } catch {
      toast(
        action === 'send' ? t('Failed to send ticket. Please try again.') : t('Failed to reject ticket. Please try again.'),
        'error',
      );
    } finally {
      setBusy(null);
    }
  };

  const requests = query.data ?? [];

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('Registrations submitted with 100% discount codes are listed here until approved.')}>
        {t('Pending Free Ticket Requests')}
      </SectionTitle>
      {query.isError && !query.data ? (
        <PanelError onRetry={() => void refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton rows={2} />
      ) : requests.length === 0 ? (
        <PanelMessage text={t('No pending free ticket requests.')} />
      ) : (
        <PanelCard>
          {requests.map((request, index) => {
            const id = requestId(request);
            return (
              <RowDivider key={id} index={index}>
                <RequestRow
                  request={request}
                  busy={busy?.id === id ? busy.action : null}
                  onSend={() =>
                    confirmAction({
                      title: t('Send Ticket'),
                      message: t('Send the ticket to this registrant now?'),
                      confirmLabel: t('Send Ticket'),
                      cancelLabel: t('Cancel'),
                      onConfirm: () => void perform(id, 'send'),
                    })
                  }
                  onReject={() =>
                    confirmAction({
                      title: t('Reject'),
                      message: t('Reject this free ticket request?'),
                      confirmLabel: t('Reject'),
                      cancelLabel: t('Cancel'),
                      destructive: true,
                      onConfirm: () => void perform(id, 'reject'),
                    })
                  }
                />
              </RowDivider>
            );
          })}
        </PanelCard>
      )}
    </View>
  );
}
