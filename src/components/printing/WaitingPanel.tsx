import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

import { AppText } from '@/components/ui';
import { PanelCard, RowDivider, SectionTitle } from '@/components/dashboard/dashboardParts';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import {
  useApproveJobMutation,
  useCancelJobMutation,
  useGetPrintJobsQuery,
  type PrintAgent,
  type Printer,
  type PrintJob,
} from '@/store/api/printingApi';

import { LabelEditor } from './LabelEditor';
import { REFRESH_MS, editsBody, printerLabel, printingErrorText, splitByPrinter, type LabelChanges } from './printingLogic';
import { ErrorText, SelectField, SmallButton, StaleNote } from './printingParts';
import { useBusyKeys } from './useBusyKeys';

const WAITING_PAGE_SIZE = 200;

export function WaitingPanel({
  eventId,
  reviewOn,
  printers,
  agents,
  filterPrinters,
  printerFilter,
  onPrinterFilterChange,
}: {
  eventId: number;
  reviewOn: boolean;
  printers: Printer[];
  agents: PrintAgent[];
  filterPrinters: Printer[];
  printerFilter: string;
  onPrinterFilterChange: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isError } = useGetPrintJobsQuery(
    { eventId, status: 'AWAITING_REVIEW', pageSize: WAITING_PAGE_SIZE },
    { pollingInterval: REFRESH_MS },
  );
  const [approveJob] = useApproveJobMutation();
  const [cancelJob] = useCancelJobMutation();
  const { isBusy, run } = useBusyKeys();
  const [edits, setEdits] = useState<Record<string, LabelChanges>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [done, setDone] = useState<Set<string>>(() => new Set());

  const rows = data ? [...data.results].reverse() : [];
  const waiting = rows.filter((job) => !done.has(job.uuid));
  if (!reviewOn && !waiting.length) return null;
  const { shown, hidden } = splitByPrinter(waiting, printerFilter);

  const toggleEditor = (job: PrintJob) =>
    setEdits((current) => {
      const next = { ...current };
      if (next[job.uuid]) delete next[job.uuid];
      else next[job.uuid] = {};
      return next;
    });

  const act = (job: PrintJob, action: 'approve' | 'skip') =>
    run(job.uuid, async () => {
      setErrors((current) => ({ ...current, [job.uuid]: null }));
      try {
        if (action === 'approve') await approveJob({ uuid: job.uuid, ...editsBody(edits[job.uuid] ?? {}) }).unwrap();
        else await cancelJob(job.uuid).unwrap();
      } catch (failure) {
        setErrors((current) => ({
          ...current,
          [job.uuid]: printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'),
        }));
        return false;
      }
      toast(action === 'approve' ? t('Label sent to the printer.') : t('Skipped.'), 'success');
      setDone((current) => new Set(current).add(job.uuid));
      return true;
    });

  const printerOf = (job: PrintJob) => {
    const printer = printers.find((row) => row.uuid === job.printer_uuid);
    return printerLabel(printer ?? { uuid: '', name: job.printer_name ?? '', connection_type: job.connection_type }, t, agents);
  };

  const timeOf = (job: PrintJob) => {
    const date = new Date(job.created_at);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
  };

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('Scanned tickets wait here until you print or skip them. The next person is at the top.')}>
        {t('Waiting for approval')}
      </SectionTitle>
      {filterPrinters.length > 1 ? (
        <SelectField
          label={t('This desk shows')}
          value={printerFilter}
          onChange={onPrinterFilterChange}
          options={[
            { value: '', label: t('All printers') },
            ...filterPrinters.map((printer) => ({ value: printer.uuid, label: printerLabel(printer, t, agents) })),
          ]}
        />
      ) : null}
      <StaleNote show={isError && Boolean(data)} />
      {shown.length ? (
        <PanelCard>
          {shown.map((job, index) => (
            <RowDivider key={job.uuid} index={index}>
              <View className="gap-2.5 py-3.5">
                <View className="gap-0.5">
                  <AppText className="font-gilroy-semibold text-[15px]">{job.holder_name || t('(no name)')}</AppText>
                  <AppText className="font-gilroy-medium text-[12px] text-muted">
                    {[job.ticket_type, printerOf(job), timeOf(job)].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <SmallButton
                    label={edits[job.uuid] ? t('Discard edits') : t('Edit label')}
                    disabled={isBusy(job.uuid)}
                    onPress={() => toggleEditor(job)}
                  />
                  <SmallButton label={t('Print')} primary disabled={isBusy(job.uuid)} onPress={() => void act(job, 'approve')} />
                  <SmallButton label={t('Skip')} disabled={isBusy(job.uuid)} onPress={() => void act(job, 'skip')} />
                </View>
                {edits[job.uuid] ? (
                  <LabelEditor
                    ticketId={job.ticket_id}
                    templateId={job.template_id}
                    printerUuid={job.printer_uuid}
                    initialHolderName={job.holder_name ?? ''}
                    initialOverrides={job.label_overrides}
                    disabled={isBusy(job.uuid)}
                    onChange={(changes) =>
                      setEdits((current) => (current[job.uuid] ? { ...current, [job.uuid]: changes } : current))
                    }
                  />
                ) : null}
                <ErrorText text={errors[job.uuid]} />
              </View>
            </RowDivider>
          ))}
        </PanelCard>
      ) : (
        <PanelCard>
          <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">
            {printerFilter ? t('Nobody is waiting at this printer.') : t('Nobody is waiting.')}
          </AppText>
        </PanelCard>
      )}
      {hidden > 0 ? (
        <AppText className="font-gilroy-medium text-[13px] text-muted">
          {t('{{count}} more waiting at other printers.', { count: hidden })}
        </AppText>
      ) : null}
    </View>
  );
}
