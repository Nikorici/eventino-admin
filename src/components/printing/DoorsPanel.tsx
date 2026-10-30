import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { Avatar, PanelCard, RowDivider, SectionTitle } from '@/components/dashboard/dashboardParts';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import {
  useAssignDoorMutation,
  useGetDoorsQuery,
  type Door,
  type EventPrintSettings,
  type PrintAgent,
  type Printer,
} from '@/store/api/printingApi';

import {
  REFRESH_MS,
  doorWarnings,
  effectiveLabel,
  offeredPrinters,
  printerLabel,
  printingErrorText,
  unavailablePrinterLabel,
  type PrinterProblem,
} from './printingLogic';
import { ErrorText, Notice, SelectField, StaleNote } from './printingParts';

export function DoorsPanel({
  eventId,
  printers,
  agents,
  settings,
  defaultProblem,
}: {
  eventId: number;
  printers: Printer[];
  agents: PrintAgent[];
  settings: EventPrintSettings;
  defaultProblem: PrinterProblem;
}) {
  const { t } = useTranslation();
  const { data, isError } = useGetDoorsQuery(eventId, { pollingInterval: REFRESH_MS });
  const [assignDoor] = useAssignDoorMutation();
  const [pending, setPending] = useState<Set<number>>(() => new Set());
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  const doors = data?.doors ?? [];
  const offered = offeredPrinters(printers, agents);
  const warnings = doorWarnings(doors, settings, t);

  const assign = async (door: Door, printerUuid: string) => {
    setErrors((current) => ({ ...current, [door.user_id]: null }));
    setPending((current) => new Set(current).add(door.user_id));
    try {
      await assignDoor({ eventId, user_id: door.user_id, printer_uuid: printerUuid || null }).unwrap();
    } catch (failure) {
      setErrors((current) => ({
        ...current,
        [door.user_id]: printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'),
      }));
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(door.user_id);
        return next;
      });
    }
  };

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('Each scanner account prints at the printer standing next to it.')}>{t('Doors')}</SectionTitle>
      <StaleNote show={isError && Boolean(data)} />
      <PanelCard>
        {doors.map((door, index) => (
          <RowDivider key={door.user_id} index={index}>
            <View className="gap-2.5 py-3.5">
              <View className="flex-row items-center gap-3">
                <Avatar name={door.name} />
                <View className="flex-1">
                  <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
                    {door.name}
                  </AppText>
                  <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted">
                    {door.email}
                  </AppText>
                </View>
              </View>
              <SelectField
                accessibilityLabel={t('Printer')}
                value={door.assigned_printer_uuid ?? ''}
                disabled={pending.has(door.user_id)}
                onChange={(uuid) => void assign(door, uuid)}
                fallbackLabel={
                  door.assigned_printer_uuid ? unavailablePrinterLabel(door.assigned_printer_uuid, printers, agents, t) : undefined
                }
                options={[
                  { value: '', label: t('Use the event default') },
                  ...offered.map((printer) => ({ value: printer.uuid, label: printerLabel(printer, t, agents) })),
                ]}
              />
              <ErrorText text={errors[door.user_id]} />
              <AppText className="font-gilroy-medium text-[12px] text-muted">
                {t('Prints at')} ·{' '}
                <AppText
                  className={cn(
                    'font-gilroy-semibold text-[12px]',
                    door.effective_printer ? 'text-primary dark:text-dark-text' : 'text-danger dark:text-danger',
                  )}
                >
                  {effectiveLabel(door, t, { agents, defaultProblem, hasDefault: Boolean(settings.default_printer_uuid) })}
                </AppText>
              </AppText>
            </View>
          </RowDivider>
        ))}
        {!doors.length ? (
          <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">
            {t('No scanner accounts on this event yet.')}
          </AppText>
        ) : null}
      </PanelCard>
      {warnings.map((warning) => (
        <Notice key={warning} text={warning} />
      ))}
    </View>
  );
}
