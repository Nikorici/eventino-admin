import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, X } from 'lucide-react-native';

import { AppText, Chip, PressableScale, ToastHost } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import {
  ACCENT_GREEN,
  ACCENT_ORANGE,
  ACCENT_RED,
  Avatar,
  HeaderAction,
  ListSkeleton,
  PDF_SHARE,
  PanelCard,
  PanelError,
  PanelMessage,
  Pill,
  RowDivider,
  SearchField,
  SectionTitle,
  XLSX_SHARE,
  formatDateTimeLabel,
  moneyLabel,
  personName,
  useFileAction,
} from '@/components/dashboard/dashboardParts';
import { useDebounce } from '@/hooks/useDebounce';
import { useThemeColor } from '@/hooks/useThemeColor';
import { eventEndpoint } from '@/lib/constants';
import { downloadAuthedFile, downloadAuthedFilePost } from '@/lib/downloads';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import {
  ordersSettlementExportEndpoint,
  useGetEventBuyersQuery,
  type BuyerParticipantInfo,
  type BuyerQuestionAnswer,
  type BuyersAttendanceFilter,
  type BuyersTimeInterval,
  type EventBuyer,
} from '@/store/api/organizerApi';
import { colors } from '@/theme/colors';

function buyerName(buyer: EventBuyer, fallback: string): string {
  return buyer.display_name?.trim() || personName(buyer, fallback);
}

function filterByAttendance(rows: EventBuyer[], attendance: BuyersAttendanceFilter): EventBuyer[] {
  if (attendance === 'all') return rows;
  return rows.filter((row) => {
    if (row.user_type !== 'buyer') return false;
    const status = (row.attendance_status ?? '').trim().toLowerCase();
    const scanned = row.scanned_count ?? 0;
    if (attendance === 'scanned') return status === 'attended' || scanned > 0;
    return status === 'no-show' || ((row.ticket_count ?? 0) > 0 && scanned === 0);
  });
}

function attendanceColor(status: string): string {
  if (status === 'Attended') return ACCENT_GREEN;
  if (status === 'Partial attendance') return ACCENT_ORANGE;
  if (status === 'No-show') return ACCENT_RED;
  return colors.muted;
}

function answerText(answer: BuyerQuestionAnswer['answer'], fallback: string): string {
  if (answer == null) return fallback;
  if (Array.isArray(answer)) return answer.length > 0 ? answer.join(', ') : fallback;
  const text = String(answer);
  const normalized = text.trim().toLowerCase();
  return normalized === '' || normalized === 'no answer' || normalized === 'n/a' ? fallback : text;
}

function titleCaseKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function participantsPreview(participants: BuyerParticipantInfo[]): string {
  return participants
    .slice(0, 2)
    .map((info) => Object.values(info).find((value) => value != null && String(value).trim() !== ''))
    .filter((value) => value != null)
    .map(String)
    .join(' | ');
}

function amountLabel(buyer: EventBuyer): string {
  const amount = moneyLabel(buyer.total_price, buyer.currency);
  return buyer.payment_method === 'INVOICE' ? `${amount} (handled by organizer)` : amount;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View
      className="flex-1 items-center rounded-[12px] border bg-white px-2 py-3 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <AppText numberOfLines={2} className="text-center font-gilroy-bold text-[13px]">
        {value}
      </AppText>
      <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[11px] text-muted">
        {label}
      </AppText>
    </View>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 gap-0.5 pr-2">
      <AppText className="font-gilroy-medium text-[11px] text-muted">{label}</AppText>
      <AppText className="font-gilroy-semibold text-[13px]">{value}</AppText>
    </View>
  );
}

function BuyerDetailSheet({ buyer, onClose }: { buyer: EventBuyer | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  if (!buyer) return null;
  const name = buyerName(buyer, t('Unknown'));
  const answers = buyer.questions_and_answers ?? [];
  const participants = buyer.participants_info ?? [];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              <Avatar name={name} image={buyer.profile_image} />
              <View className="flex-1">
                <AppText numberOfLines={1} className="font-gilroy-bold text-[17px]">
                  {name}
                </AppText>
                <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
                  {buyer.email || '-'}
                </AppText>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t('Close')}
              className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              <View className="flex-row gap-2.5">
                <DetailStat label={t('Attendance')} value={`${buyer.scanned_count ?? 0} / ${buyer.ticket_count ?? 0}`} />
                <DetailStat label={t('Lifetime Value')} value={amountLabel(buyer)} />
                <DetailStat label={t('Last Seen')} value={formatDateTimeLabel(buyer.date, i18n.language)} />
              </View>

              <View className="gap-2">
                <AppText className="font-gilroy-bold text-[15px]">{t('Order Summary')}</AppText>
                <View
                  className="flex-row flex-wrap gap-y-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                  style={{ borderColor: cardBorder }}
                >
                  <DetailField label={t('Ticket Type')} value={buyer.ticket_name || '-'} />
                  <DetailField label={t('Ticket Count')} value={String(buyer.ticket_count ?? 0)} />
                  <DetailField label={t('Coupon')} value={buyer.coupon_code || '-'} />
                  <DetailField label={t('Payment Method')} value={buyer.payment_method || '-'} />
                </View>
              </View>

              <View className="gap-2">
                <AppText className="font-gilroy-bold text-[15px]">{t('Questionnaire')}</AppText>
                {answers.length > 0 ? (
                  answers.map((qa, index) => (
                    <View
                      key={`${qa.question ?? 'question'}-${index}`}
                      className="rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                      style={{ borderColor: cardBorder }}
                    >
                      <AppText className="font-gilroy-semibold text-[13px]">{qa.question || t('Question')}</AppText>
                      <AppText className="mt-1 font-gilroy-medium text-[13px] text-muted">
                        {answerText(qa.answer, t('No answer'))}
                      </AppText>
                    </View>
                  ))
                ) : (
                  <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No additional answers')}</AppText>
                )}
              </View>

              <View className="gap-2">
                <AppText className="font-gilroy-bold text-[15px]">{t('Participants')}</AppText>
                {participants.length > 0 ? (
                  participants.map((participant, index) => (
                    <View
                      key={`participant-${index}`}
                      className="rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
                      style={{ borderColor: cardBorder }}
                    >
                      <AppText className="mb-2 font-gilroy-semibold text-[13px]">{`${t('Attendee')} #${index + 1}`}</AppText>
                      <View className="flex-row flex-wrap gap-y-3">
                        {Object.entries(participant).map(([key, value]) => (
                          <DetailField
                            key={`${index}-${key}`}
                            label={titleCaseKey(key)}
                            value={value != null && String(value).trim() !== '' ? String(value) : '-'}
                          />
                        ))}
                      </View>
                    </View>
                  ))
                ) : (
                  <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No participant details')}</AppText>
                )}
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
      <ToastHost />
    </Modal>
  );
}

function BuyerRow({
  buyer,
  index,
  onPress,
  onDownload,
  downloading,
}: {
  buyer: EventBuyer;
  index: number;
  onPress: () => void;
  onDownload?: () => void;
  downloading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const downloadTint = useThemeColor(colors.primary, colors.dark.text);
  const name = buyerName(buyer, t('Unknown'));
  const ticketCount = buyer.ticket_count ?? 0;
  const status = buyer.user_type !== 'follower' && buyer.attendance_status ? buyer.attendance_status : 'Not Applicable';
  const answers = buyer.questions_and_answers ?? [];
  const answered = answers.filter((qa) => answerText(qa.answer, '') !== '').length;
  const participants = buyer.participants_info ?? [];
  const preview = participantsPreview(participants);
  return (
    <View className="flex-row items-start gap-2 py-3">
      <Pressable
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={name}
        className="flex-1 gap-2"
      >
        <View className="flex-row items-center gap-3">
          <Avatar name={name} image={buyer.profile_image} />
          <View className="flex-1">
            <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
              {`${index + 1}. ${name}`}
            </AppText>
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
              {buyer.email || '-'}
            </AppText>
          </View>
          <View className="items-end">
            <AppText className="font-gilroy-bold text-[14px]">{moneyLabel(buyer.total_price, buyer.currency)}</AppText>
            <AppText className="font-gilroy-medium text-[11px] text-muted">
              {`${ticketCount} ${ticketCount === 1 ? t('ticket') : t('tickets')}`}
            </AppText>
          </View>
        </View>
        <View className="flex-row flex-wrap items-center gap-1.5 pl-[52px]">
          <Pill label={status} color={attendanceColor(status)} />
          {buyer.coupon_code ? <Pill label={buyer.coupon_code} color={colors.primaryLight} /> : null}
          <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[11px] text-muted">
            {[buyer.ticket_name, formatDateTimeLabel(buyer.date, i18n.language)].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <View className="flex-row flex-wrap items-center gap-1.5 pl-[52px]">
          <Pill label={`Q&A: ${answered}/${answers.length}`} color={colors.muted} />
          <Pill label={`${t('Attendees')}: ${participants.length}`} color={colors.muted} />
          {preview ? (
            <AppText numberOfLines={1} className="shrink font-gilroy-medium text-[11px] text-muted">
              {preview}
            </AppText>
          ) : null}
        </View>
        {buyer.payment_method === 'INVOICE' ? (
          <AppText className="pl-[52px] font-gilroy-medium text-[11px] text-muted">{`${buyer.payment_method} (handled by organizer)`}</AppText>
        ) : null}
      </Pressable>
      {onDownload ? (
        <PressableScale
          onPress={onDownload}
          disabled={downloading}
          accessibilityLabel={t('Ticket')}
          className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
        >
          {downloading ? <ActivityIndicator size="small" color={colors.muted} /> : <Download size={16} color={downloadTint} />}
        </PressableScale>
      ) : null}
    </View>
  );
}

export function BuyersPanel({
  eventId,
  isCancelled,
  refreshSignal,
}: {
  eventId: number;
  isCancelled: boolean;
  refreshSignal: number;
}) {
  const { t, i18n } = useTranslation();
  const monthTint = useThemeColor(colors.primary, colors.dark.text);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 150);
  const [page, setPage] = useState(1);
  const [timeInterval, setTimeInterval] = useState<BuyersTimeInterval>('all');
  const [attendance, setAttendance] = useState<BuyersAttendanceFilter>('all');
  const [selected, setSelected] = useState<EventBuyer | null>(null);
  const [settlement, setSettlement] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const { busyKey, run } = useFileAction();

  const query = useGetEventBuyersQuery(
    { eventId, page, search, attendance, timeInterval },
    { skip: isCancelled, refetchOnMountOrArgChange: true },
  );
  const { refetch } = query;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (refreshSignal === 0 || isCancelled) return;
    if (page > 1) setPage(1);
    else void refetch();
  }, [refreshSignal]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return filterByAttendance(query.data?.results ?? [], attendance).filter((buyer) => {
      const key = String(buyer.order_id ?? buyer.id ?? '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [query.data?.results, attendance]);
  const loaded = query.data?.results.length ?? 0;
  const remaining = Math.max(0, (query.data?.total_count ?? 0) - loaded);
  const monthLabel = format(new Date(settlement.year, settlement.month - 1, 1), 'LLLL yyyy', {
    locale: dateFnsLocale(i18n.language),
  });

  const shiftMonth = (delta: number) => {
    void haptics.selection();
    setSettlement((current) => {
      const shifted = new Date(current.year, current.month - 1 + delta, 1);
      return { month: shifted.getMonth() + 1, year: shifted.getFullYear() };
    });
  };

  const onExportTickets = () =>
    run(
      'export',
      (token) =>
        downloadAuthedFilePost(
          eventEndpoint.ticketsExport,
          token,
          { event_id: eventId },
          `Ticket Export - Event ${eventId}.xlsx`,
        ),
      { ...XLSX_SHARE, dialogTitle: t('Export Excel') },
    );

  const onExportSettlement = () => {
    const period = `${settlement.year}-${String(settlement.month).padStart(2, '0')}`;
    return run(
      'settlement',
      (token) =>
        downloadAuthedFilePost(
          ordersSettlementExportEndpoint,
          token,
          { event_id: eventId, month: settlement.month, year: settlement.year },
          `Decont_${eventId}_${period}.xlsx`,
        ),
      { ...XLSX_SHARE, dialogTitle: t('Export Settlement') },
    );
  };

  const onDownloadTicket = (buyer: EventBuyer, orderId: number) =>
    run(
      `ticket-${orderId}`,
      (token) =>
        downloadAuthedFile(
          eventEndpoint.orderTicketsPdf(orderId),
          token,
          `Ticket_${(buyer.name ?? 'Customer').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_')}_Order_${orderId}.pdf`,
        ),
      { ...PDF_SHARE, dialogTitle: t('Ticket') },
    );

  const intervalOptions: { key: BuyersTimeInterval; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'month', label: t('Monthly') },
    { key: 'week', label: t('Weekly') },
    { key: 'day', label: t('Daily') },
  ];
  const attendanceOptions: { key: BuyersAttendanceFilter; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'scanned', label: t('Scanned') },
    { key: 'not_scanned', label: t('Not Scanned') },
  ];

  const emptyText = searchInput.trim()
    ? t('No results match your search')
    : t('No customers found for the selected time period.');

  return (
    <View className="gap-3">
      <SectionTitle>{t('List of Customers')}</SectionTitle>
      <View className="flex-row">
        <HeaderAction
          icon={FileSpreadsheet}
          label={busyKey === 'export' ? t('Exporting...') : t('Export Excel')}
          onPress={() => void onExportTickets()}
          loading={busyKey === 'export'}
          variant="outline"
        />
      </View>
      <View className="flex-row items-center gap-2.5">
        <View className="h-11 flex-1 flex-row items-center justify-between rounded-[10px] border border-app-border bg-white px-1 dark:border-dark-border dark:bg-dark-surface">
          <PressableScale
            onPress={() => shiftMonth(-1)}
            accessibilityLabel={t('Previous month')}
            className="h-9 w-9 items-center justify-center"
          >
            <ChevronLeft size={18} color={monthTint} />
          </PressableScale>
          <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[13px] capitalize">
            {monthLabel}
          </AppText>
          <PressableScale
            onPress={() => shiftMonth(1)}
            accessibilityLabel={t('Next month')}
            className="h-9 w-9 items-center justify-center"
          >
            <ChevronRight size={18} color={monthTint} />
          </PressableScale>
        </View>
        <HeaderAction
          icon={FileSpreadsheet}
          label={t('Export Settlement')}
          onPress={() => void onExportSettlement()}
          loading={busyKey === 'settlement'}
          variant="outline"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0" contentContainerClassName="gap-2">
        {intervalOptions.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={timeInterval === option.key}
            onPress={() => {
              setTimeInterval(option.key);
              setPage(1);
            }}
          />
        ))}
      </ScrollView>
      <SearchField value={searchInput} onChange={setSearchInput} placeholder={t('Search by name, email, phone or order...')} />
      <View className="flex-row gap-2">
        {attendanceOptions.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={attendance === option.key}
            onPress={() => {
              setAttendance(option.key);
              setPage(1);
            }}
          />
        ))}
      </View>

      {query.isError && !query.data ? (
        <PanelError onRetry={() => void refetch()} />
      ) : query.isLoading || (query.isFetching && page === 1 && rows.length === 0) ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <PanelMessage text={emptyText} />
      ) : (
        <>
          <PanelCard>
            {rows.map((buyer, index) => {
              const orderId = buyer.user_type === 'buyer' ? (buyer.order_id ?? buyer.id ?? null) : null;
              return (
                <RowDivider key={`${buyer.order_id ?? buyer.id ?? index}`} index={index}>
                  <BuyerRow
                    buyer={buyer}
                    index={index}
                    onPress={() => setSelected(buyer)}
                    onDownload={orderId != null ? () => void onDownloadTicket(buyer, orderId) : undefined}
                    downloading={orderId != null && busyKey === `ticket-${orderId}`}
                  />
                </RowDivider>
              );
            })}
          </PanelCard>
          {query.data?.has_next ? (
            <PressableScale
              onPress={() => setPage((current) => current + 1)}
              disabled={query.isFetching}
              accessibilityLabel={t('Load More')}
              className="h-11 items-center justify-center rounded-[10px] border border-app-border dark:border-dark-border"
            >
              {query.isFetching ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <AppText className="font-gilroy-semibold text-[14px] text-primary dark:text-dark-text">
                  {`${t('Load More')} (${remaining} ${t('remaining')})`}
                </AppText>
              )}
            </PressableScale>
          ) : null}
        </>
      )}

      <BuyerDetailSheet buyer={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
