import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

import { AppText, PressableScale } from '@/components/ui';
import { PanelCard, RowDivider, SectionTitle } from '@/components/dashboard/dashboardParts';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { dateFnsLocale } from '@/lib/format';
import {
  useCancelJobMutation,
  useGetPrintJobsQuery,
  useReprintJobMutation,
  useResolveJobMutation,
  type JobStatus,
  type PrintJob,
} from '@/store/api/printingApi';

import { LabelEditor } from './LabelEditor';
import {
  JOB_STATUSES,
  REFRESH_MS,
  REPRINTABLE,
  TONE_COLORS,
  clearIntent,
  connectionLabel,
  editsBody,
  intentId,
  isFreeLabel,
  jobHolderName,
  jobReason,
  jobTicketType,
  jobTone,
  printingErrorText,
  splitByPrinter,
  type LabelChanges,
} from './printingLogic';
import { ErrorText, SelectField, SmallButton, StaleNote, StatusPill, Tag } from './printingParts';
import { useBusyKeys } from './useBusyKeys';

type JobAction = 'cancel' | 'reprint' | 'mark_printed' | 'resolve_reprint';

const isJobStatus = (value: string): value is JobStatus => JOB_STATUSES.some((status) => status === value);

export function JobsPanel({ eventId, printerFilter }: { eventId: number; printerFilter: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [pageNumber, setPageNumber] = useState(1);
  const [editing, setEditing] = useState<{ uuid: string; action: JobAction; changes: LabelChanges } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { isBusy, run } = useBusyKeys();

  const jobs = useGetPrintJobsQuery(
    { eventId, status: status || undefined, page: pageNumber },
    { pollingInterval: REFRESH_MS },
  );
  const unknownJobs = useGetPrintJobsQuery({ eventId, status: 'UNKNOWN' }, { pollingInterval: REFRESH_MS });
  const [cancelJob] = useCancelJobMutation();
  const [reprintJob] = useReprintJobMutation();
  const [resolveJob] = useResolveJobMutation();

  const page = jobs.data ?? { results: [], count: 0, page: 1, pages: 1 };
  const unknown = (unknownJobs.data?.results ?? []).filter((job) => !job.resolved_by_id);
  const { shown: unknownShown, hidden: unknownHidden } = splitByPrinter(unknown, printerFilter);
  const stale = (jobs.isError && Boolean(jobs.data)) || (unknownJobs.isError && Boolean(unknownJobs.data));

  const act = (job: PrintJob, action: JobAction, changes: LabelChanges = {}) =>
    run(job.uuid, async () => {
      setErrors((current) => ({ ...current, [job.uuid]: null }));
      const key = action === 'reprint' ? `reprint:${job.uuid}` : action === 'resolve_reprint' ? `resolve-reprint:${job.uuid}` : null;
      try {
        if (action === 'cancel') await cancelJob(job.uuid).unwrap();
        else if (action === 'mark_printed') await resolveJob({ uuid: job.uuid, action: 'mark_printed' }).unwrap();
        else if (action === 'reprint' && key) {
          await reprintJob({
            uuid: job.uuid,
            client_request_id: intentId(key),
            ...editsBody(changes),
            ...(changes.freeLabel === undefined ? {} : { free_label: changes.freeLabel }),
          }).unwrap();
        } else if (key) {
          await resolveJob({ uuid: job.uuid, action: 'reprint', client_request_id: intentId(key), ...editsBody(changes) }).unwrap();
        }
      } catch (failure) {
        setErrors((current) => ({
          ...current,
          [job.uuid]: printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'),
        }));
        return false;
      }
      if (key) clearIntent(key);
      setEditing((current) => (current?.uuid === job.uuid ? null : current));
      toast(t('Done.'), 'success');
      return true;
    });

  const openEditor = (job: PrintJob, action: JobAction) => {
    setErrors((current) => ({ ...current, [job.uuid]: null }));
    setEditing({ uuid: job.uuid, action, changes: {} });
  };

  const createdAt = (job: PrintJob) => {
    const date = new Date(job.created_at);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM, HH:mm', { locale: dateFnsLocale(i18n.language) });
  };

  const holder = (job: PrintJob) => (
    <View className="flex-1 flex-row items-center gap-1.5">
      <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[14px]">
        {jobHolderName(job) || '-'}
      </AppText>
      {isFreeLabel(job) ? <Tag label={t('No ticket')} /> : null}
      {job.holder_name_override ? <Tag label={t('edited')} /> : null}
    </View>
  );

  const editor = (job: PrintJob) =>
    editing?.uuid === job.uuid ? (
      <View className="gap-3 pt-1">
        <LabelEditor
          ticketId={isFreeLabel(job) ? null : job.ticket_id}
          eventId={eventId}
          templateId={job.template_id}
          printerUuid={job.printer_uuid}
          initialHolderName={job.holder_name ?? ''}
          initialOverrides={job.label_overrides}
          initialFreeLabel={isFreeLabel(job) ? job.free_label ?? undefined : undefined}
          disabled={isBusy(job.uuid)}
          onChange={(changes) => setEditing((current) => (current?.uuid === job.uuid ? { ...current, changes } : current))}
        />
        <View className="flex-row gap-2">
          <SmallButton
            label={t('Print')}
            primary
            disabled={isBusy(job.uuid)}
            onPress={() => void act(job, editing.action, editing.changes)}
          />
          <SmallButton label={t('Cancel')} onPress={() => setEditing(null)} />
        </View>
      </View>
    ) : null;

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('What this event has printed, newest first.')}>{t('Printed labels')}</SectionTitle>
      <SelectField
        accessibilityLabel={t('Status')}
        value={status}
        onChange={(value) => {
          setStatus(isJobStatus(value) ? value : '');
          setPageNumber(1);
        }}
        options={[
          { value: '', label: t('All statuses') },
          ...JOB_STATUSES.map((value) => ({ value, label: t(`job_status_${value}`) })),
        ]}
      />
      <StaleNote show={stale} />
      {unknownHidden > 0 && !unknownShown.length ? (
        <AppText className="font-gilroy-medium text-[13px] text-muted">
          {t('{{count}} labels at other printers need a look.', { count: unknownHidden })}
        </AppText>
      ) : null}
      {unknownShown.length > 0 ? (
        <PanelCard className="gap-2 py-4" >
          <AppText className="font-gilroy-bold text-[15px]" style={{ color: TONE_COLORS.warn }}>
            {t('Needs a look')}
          </AppText>
          <AppText className="font-gilroy-medium text-[13px] text-muted">
            {t('A delayed label can still come out — look at the printer before you choose.')}
          </AppText>
          {unknownShown.map((job) => (
            <View key={job.uuid} className="gap-1.5 border-t border-black/5 pt-2.5 dark:border-white/10">
              {holder(job)}
              <AppText className="font-gilroy-medium text-[12px] text-muted">
                {[job.printer_name, jobReason(job, t)].filter(Boolean).join(' · ')}
              </AppText>
              {editing?.uuid === job.uuid ? (
                editor(job)
              ) : (
                <View className="flex-row gap-2 pt-1">
                  <SmallButton label={t('It printed')} disabled={isBusy(job.uuid)} onPress={() => void act(job, 'mark_printed')} />
                  <SmallButton
                    label={t('Reprint')}
                    disabled={isBusy(job.uuid)}
                    onPress={() => (isFreeLabel(job) ? void act(job, 'resolve_reprint') : openEditor(job, 'resolve_reprint'))}
                  />
                </View>
              )}
              <ErrorText text={errors[job.uuid]} />
            </View>
          ))}
        </PanelCard>
      ) : null}
      <PanelCard>
        {page.results.map((job, index) => {
          const reason = jobReason(job, t);
          const type = jobTicketType(job);
          return (
            <RowDivider key={job.uuid} index={index}>
              <View className="gap-1 py-3">
                <View className="flex-row items-center justify-between gap-2">
                  {holder(job)}
                  <StatusPill label={t(`job_status_${job.status}`)} tone={jobTone(job.status)} />
                </View>
                <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
                  {[type || '-', job.printer_name ? `${job.printer_name} · ${connectionLabel(job.connection_type, t)}` : '-'].join(' · ')}
                </AppText>
                {reason ? <AppText className="font-gilroy-medium text-[12px] text-danger dark:text-danger">{reason}</AppText> : null}
                <View className="min-h-8 flex-row items-center justify-between gap-2">
                  <AppText className="font-gilroy-medium text-[12px] text-muted">{createdAt(job)}</AppText>
                  {editing?.uuid === job.uuid ? null : job.status === 'QUEUED' ? (
                    <SmallButton compact label={t('Cancel')} disabled={isBusy(job.uuid)} onPress={() => void act(job, 'cancel')} />
                  ) : REPRINTABLE.includes(job.status) ? (
                    <SmallButton compact label={t('Reprint')} disabled={isBusy(job.uuid)} onPress={() => openEditor(job, 'reprint')} />
                  ) : null}
                </View>
                {editor(job)}
                <ErrorText text={errors[job.uuid]} />
              </View>
            </RowDivider>
          );
        })}
        {!page.results.length ? (
          <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">
            {status ? t('No labels with this status.') : t('Nothing printed yet.')}
          </AppText>
        ) : null}
      </PanelCard>
      {page.pages > 1 ? (
        <View className="flex-row items-center justify-between gap-2">
          <SmallButton label={t('Previous')} disabled={page.page <= 1} onPress={() => setPageNumber(page.page - 1)} />
          <PressableScale accessibilityLabel={t('Page {{page}} of {{pages}}', { page: page.page, pages: page.pages })}>
            <AppText className="font-gilroy-semibold text-[13px] text-primary/80 dark:text-dark-text/80">
              {t('Page {{page}} of {{pages}}', { page: page.page, pages: page.pages })}
            </AppText>
          </PressableScale>
          <SmallButton label={t('Next')} disabled={page.page >= page.pages} onPress={() => setPageNumber(page.page + 1)} />
        </View>
      ) : null}
    </View>
  );
}
