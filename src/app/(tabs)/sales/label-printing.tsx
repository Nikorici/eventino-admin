import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock, Printer as PrinterIcon } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, Screen, SegmentedControl, Skeleton, Stepper } from '@/components/ui';
import { PanelCard, SectionTitle } from '@/components/dashboard/dashboardParts';
import { DoorsPanel } from '@/components/printing/DoorsPanel';
import { JobsPanel } from '@/components/printing/JobsPanel';
import { PrintLabelPanel } from '@/components/printing/PrintLabelPanel';
import { WaitingPanel } from '@/components/printing/WaitingPanel';
import {
  defaultPrinterProblem,
  defaultPrinterWarning,
  offeredPrinters,
  printerLabel,
  printingErrorText,
  unavailablePrinterLabel,
} from '@/components/printing/printingLogic';
import { ErrorText, Notice, SelectField } from '@/components/printing/printingParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEventId } from '@/hooks/useSelectedEvent';
import { extractApiError } from '@/lib/apiError';
import { navigate } from '@/lib/nav';
import { cache } from '@/lib/storage';
import {
  useGetEventPrintSettingsQuery,
  useGetLabelTemplatesQuery,
  useGetPrintAgentsQuery,
  useGetPrintersQuery,
  useUpdateEventPrintSettingsMutation,
  type EventPrintSettings,
} from '@/store/api/printingApi';

type PrintMode = 'off' | 'automatic' | 'review';

const PRINT_MODES: { value: PrintMode; label: string; values: Partial<EventPrintSettings> }[] = [
  { value: 'off', label: 'Off', values: { auto_print_enabled: false, review_before_print: false } },
  { value: 'automatic', label: 'Automatic', values: { auto_print_enabled: true, review_before_print: false } },
  { value: 'review', label: 'Review first', values: { auto_print_enabled: true, review_before_print: true } },
];

const PRINT_MODE_HINTS: Record<PrintMode, string> = {
  off: 'Scans do not print labels.',
  automatic: 'Every valid scan prints a label.',
  review: 'Every valid scan waits in the list below until someone presses Print.',
};

const printModeOf = (settings: EventPrintSettings): PrintMode => {
  if (!settings.auto_print_enabled) return 'off';
  return settings.review_before_print ? 'review' : 'automatic';
};

const filterKey = (eventId: number) => `eventino.labelPrinting.printerFilter.${eventId}`;

const isDenied = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error && (error.status === 403 || error.status === 404);

export default function LabelPrintingScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const eventId = useSelectedEventId();
  const skip = eventId == null;
  const settingsQuery = useGetEventPrintSettingsQuery(eventId ?? 0, { skip });
  const printersQuery = useGetPrintersQuery(eventId ?? 0, { skip });
  const templatesQuery = useGetLabelTemplatesQuery(eventId ?? 0, { skip });
  const agentsQuery = useGetPrintAgentsQuery();
  const [updateSettings] = useUpdateEventPrintSettingsMutation();
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [printerFilter, setPrinterFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (eventId == null) return;
    void cache.get<string>(filterKey(eventId)).then((stored) => setPrinterFilter(stored ?? ''));
  }, [eventId]);

  const chooseFilter = (uuid: string) => {
    if (eventId == null) return;
    setPrinterFilter(uuid);
    void (uuid ? cache.set(filterKey(eventId), uuid) : cache.remove(filterKey(eventId)));
  };

  const patch = async (key: string, values: Partial<EventPrintSettings>) => {
    if (eventId == null) return;
    try {
      await updateSettings({ eventId, values }).unwrap();
      setErrors((current) => ({ ...current, [key]: null }));
    } catch (failure) {
      setErrors((current) => ({
        ...current,
        [key]: printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'),
      }));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([settingsQuery.refetch(), printersQuery.refetch(), templatesQuery.refetch(), agentsQuery.refetch()]).catch(
      () => undefined,
    );
    setRefreshing(false);
  };

  const settings = settingsQuery.data;
  const printers = printersQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const printersKnown = Boolean(printersQuery.data);

  const body = () => {
    if (!settings && settingsQuery.isError && isDenied(settingsQuery.error)) {
      return <EmptyState icon={Lock} title={t("You don't have access to label printing for this event.")} />;
    }
    if (!settings && settingsQuery.isError) {
      return (
        <EmptyState
          icon={PrinterIcon}
          title={t('Something went wrong. Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void settingsQuery.refetch()}
        />
      );
    }
    if (!settings || eventId == null) {
      return (
        <View className="gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 w-full rounded-[12px]" />
          <Skeleton className="h-40 w-full rounded-[12px]" />
        </View>
      );
    }

    const offered = offeredPrinters(printers, agents);
    const defaultProblem = printersKnown ? defaultPrinterProblem(settings, printers, agents) : null;
    const defaultWarning = defaultPrinterWarning(defaultProblem, t);
    const printMode = printModeOf(settings);
    const filter = printersKnown && offered.some((printer) => printer.uuid === printerFilter) ? printerFilter : '';

    return (
      <View className="gap-7">
        <View className="gap-3">
          <SectionTitle subtitle={t('Print a label automatically when a ticket is scanned at this event.')}>
            {t('Label printing')}
          </SectionTitle>
          <PanelCard className="gap-4 py-4">
            <View className="gap-2">
              <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Print mode')}</AppText>
              <SegmentedControl<PrintMode>
                value={printMode}
                onChange={(next) => {
                  const mode = PRINT_MODES.find((entry) => entry.value === next);
                  if (mode) void patch('print_mode', mode.values);
                }}
                options={PRINT_MODES.map((mode) => ({ value: mode.value, label: t(mode.label) }))}
              />
              <AppText className="font-gilroy-medium text-[13px] text-muted">{t(PRINT_MODE_HINTS[printMode])}</AppText>
              <ErrorText text={errors.print_mode} />
            </View>
            <View className="gap-2">
              <SelectField
                label={t('Default printer')}
                value={settings.default_printer_uuid ?? ''}
                onChange={(uuid) => void patch('default_printer_uuid', { default_printer_uuid: uuid || null })}
                fallbackLabel={
                  settings.default_printer_uuid
                    ? unavailablePrinterLabel(settings.default_printer_uuid, printers, agents, t)
                    : undefined
                }
                options={[
                  { value: '', label: t('None') },
                  ...offered.map((printer) => ({ value: printer.uuid, label: printerLabel(printer, t, agents) })),
                ]}
              />
              {defaultWarning ? <Notice text={defaultWarning} /> : null}
              <ErrorText text={errors.default_printer_uuid} />
            </View>
            <View className="gap-2">
              <SelectField
                label={t('Label layout')}
                value={settings.default_template_id ? String(settings.default_template_id) : ''}
                onChange={(id) => void patch('default_template_id', { default_template_id: id ? Number(id) : null })}
                options={[
                  { value: '', label: t('None') },
                  ...templates.map((template) => ({ value: String(template.id), label: template.name })),
                ]}
              />
              <ErrorText text={errors.default_template_id} />
            </View>
            <View className="gap-2">
              <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Copies')}</AppText>
              <Stepper
                value={settings.default_copies}
                min={1}
                max={10}
                onChange={(copies) => void patch('default_copies', { default_copies: Math.max(1, Math.floor(copies) || 1) })}
              />
              <ErrorText text={errors.default_copies} />
            </View>
          </PanelCard>
        </View>

        <WaitingPanel
          eventId={eventId}
          reviewOn={printMode === 'review'}
          printers={printers}
          agents={agents}
          filterPrinters={offered}
          printerFilter={filter}
          onPrinterFilterChange={chooseFilter}
        />
        <DoorsPanel eventId={eventId} printers={printers} agents={agents} settings={settings} defaultProblem={defaultProblem} />
        <JobsPanel eventId={eventId} printerFilter={filter} />
        <PrintLabelPanel eventId={eventId} printers={printers} agents={agents} templates={templates} settings={settings} />
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Label Printing')} onBack={navigate.back} />
      <ScrollView
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />}
      >
        {body()}
      </ScrollView>
    </Screen>
  );
}
