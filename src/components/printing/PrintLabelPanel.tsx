import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, GlassButton, GlassInput, PressableScale, SegmentedControl } from '@/components/ui';
import { PanelCard, RowDivider, SectionTitle } from '@/components/dashboard/dashboardParts';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import {
  useCreateManualJobMutation,
  useSearchPrintTicketsQuery,
  type EventPrintSettings,
  type LabelTemplate,
  type PrintAgent,
  type Printer,
  type TicketSearchResult,
} from '@/store/api/printingApi';

import { LabelEditor } from './LabelEditor';
import {
  ACTION_COOLDOWN_MS,
  clearIntent,
  editsBody,
  intentId,
  offeredPrinters,
  printerLabel,
  printingErrorText,
  unavailablePrinterLabel,
  wait,
  type LabelChanges,
} from './printingLogic';
import { ErrorText, Notice, SelectField } from './printingParts';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

type LabelKind = 'attendee' | 'free';

export function PrintLabelPanel({
  eventId,
  printers,
  agents,
  templates,
  settings,
}: {
  eventId: number;
  printers: Printer[];
  agents: PrintAgent[];
  templates: LabelTemplate[];
  settings: EventPrintSettings;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [kind, setKind] = useState<LabelKind>('attendee');
  const [freeEdits, setFreeEdits] = useState<LabelChanges>({});
  const [freeRound, setFreeRound] = useState(0);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<TicketSearchResult | null>(null);
  const [edits, setEdits] = useState<LabelChanges>({});
  const [printerUuid, setPrinterUuid] = useState(settings.default_printer_uuid ?? '');
  const [templateId, setTemplateId] = useState(settings.default_template_id ? String(settings.default_template_id) : '');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printing = useRef(false);
  const [createManualJob] = useCreateManualJobMutation();

  useEffect(() => {
    setPrinterUuid(settings.default_printer_uuid ?? '');
    setTemplateId(settings.default_template_id ? String(settings.default_template_id) : '');
  }, [settings.default_printer_uuid, settings.default_template_id]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searchable = debounced.length >= SEARCH_MIN_LENGTH && kind === 'attendee' && !selected;
  const { data: found } = useSearchPrintTicketsQuery({ eventId, q: debounced }, { skip: !searchable });
  const results = searchable && query.trim().length >= SEARCH_MIN_LENGTH ? found?.results ?? [] : [];

  const layoutId = templateId ? Number(templateId) : settings.default_template_id || null;
  const offered = offeredPrinters(printers, agents);
  const printerOffered = offered.some((printer) => printer.uuid === printerUuid);

  const send = async (key: string, body: Parameters<typeof createManualJob>[0], successText: string, reset: () => void) => {
    if (printing.current) return;
    printing.current = true;
    setError(null);
    setBusy(true);
    try {
      await createManualJob(body).unwrap();
    } catch (failure) {
      setBusy(false);
      setError(printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'));
      printing.current = false;
      return;
    }
    setBusy(false);
    toast(successText, 'success');
    reset();
    setLocked(true);
    await wait(ACTION_COOLDOWN_MS);
    clearIntent(key);
    setLocked(false);
    printing.current = false;
  };

  const print = () => {
    if (!layoutId || !printerOffered) return;
    if (kind === 'free') {
      const freeLabel = freeEdits.freeLabel;
      if (!freeLabel) return;
      const key = `free:${eventId}:${printerUuid}:${layoutId}`;
      const name = freeLabel.texts?.name ?? '';
      void send(
        key,
        { event_id: eventId, printer_uuid: printerUuid, template_id: layoutId, client_request_id: intentId(key), free_label: freeLabel },
        name ? t('Label sent for {{name}}.', { name }) : t('Label sent to the printer.'),
        () => {
          setFreeEdits({});
          setFreeRound((current) => current + 1);
        },
      );
      return;
    }
    if (!selected) return;
    const key = `manual:${selected.id}:${printerUuid}`;
    const name = edits.holderName || selected.holder_name || '';
    void send(
      key,
      {
        ticket_id: selected.id,
        printer_uuid: printerUuid,
        template_id: layoutId,
        copies: 1,
        client_request_id: intentId(key),
        ...editsBody(edits),
      },
      t('Label sent for {{name}}.', { name }),
      () => {
        setSelected(null);
        setEdits({});
        setQuery('');
      },
    );
  };

  const ready = (kind === 'free' ? Boolean(freeEdits.freeLabel) : Boolean(selected)) && printerOffered && Boolean(layoutId);

  return (
    <View className="gap-3">
      <SectionTitle subtitle={t('For a badge that was lost or damaged at the desk.')}>{t('Print a label')}</SectionTitle>
      <PanelCard className="gap-4 py-4">
        <SegmentedControl<LabelKind>
          value={kind}
          onChange={(next) => {
            if (busy) return;
            setError(null);
            setKind(next);
          }}
          options={[
            { value: 'attendee', label: t('Attendee') },
            { value: 'free', label: t('No ticket') },
          ]}
        />
        {kind === 'attendee' ? (
          <View className="gap-2">
            <GlassInput
              label={t('Attendee')}
              placeholder={t('Name or ticket code')}
              value={selected ? selected.holder_name ?? '' : query}
              autoCorrect={false}
              onChangeText={(text) => {
                setSelected(null);
                setEdits({});
                setError(null);
                setQuery(text);
              }}
            />
            {results.length > 0 ? (
              <View className="rounded-[10px] border border-app-border px-3 dark:border-dark-border">
                {results.map((ticket, index) => (
                  <RowDivider key={ticket.id} index={index}>
                    <PressableScale
                      accessibilityLabel={ticket.holder_name || t('(no name)')}
                      onPress={() => {
                        haptics.selection();
                        setError(null);
                        setSelected(ticket);
                        setEdits({});
                      }}
                      className="gap-0.5 py-2.5"
                    >
                      <AppText className="font-gilroy-semibold text-[14px]">{ticket.holder_name || t('(no name)')}</AppText>
                      <AppText className="font-gilroy-medium text-[12px] text-muted">
                        {[ticket.ticket_type, ticket.scanned ? t('Already scanned') : t('Not scanned yet')].filter(Boolean).join(' · ')}
                      </AppText>
                    </PressableScale>
                  </RowDivider>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <SelectField
          label={t('Printer')}
          value={printerUuid}
          onChange={setPrinterUuid}
          fallbackLabel={printerUuid ? unavailablePrinterLabel(printerUuid, printers, agents, t) : undefined}
          options={[
            { value: '', label: t('Choose a printer') },
            ...offered.map((printer) => ({ value: printer.uuid, label: printerLabel(printer, t, agents) })),
          ]}
        />
        <View className="gap-2">
          <SelectField
            label={t('Label layout')}
            value={templateId}
            onChange={setTemplateId}
            options={[
              { value: '', label: t('Event default') },
              ...templates.map((template) => ({ value: String(template.id), label: template.name })),
            ]}
          />
          {layoutId ? null : <Notice text={t('This event has no default label layout. Choose a layout to print.')} />}
        </View>
        {kind === 'free' ? (
          <LabelEditor
            key={`free:${eventId}:${layoutId ?? ''}:${freeRound}`}
            eventId={eventId}
            templateId={layoutId}
            printerUuid={printerOffered ? printerUuid : null}
            disabled={busy || locked}
            onChange={setFreeEdits}
          />
        ) : null}
        {kind === 'attendee' && selected ? (
          <LabelEditor
            key={`${selected.id}:${layoutId ?? ''}`}
            ticketId={selected.id}
            templateId={layoutId}
            printerUuid={printerOffered ? printerUuid : null}
            disabled={busy || locked}
            onChange={setEdits}
          />
        ) : null}
        <GlassButton
          label={busy ? t('Printing...') : t('Print one label')}
          disabled={!ready || busy || locked}
          onPress={print}
        />
        <ErrorText text={error} />
      </PanelCard>
    </View>
  );
}
