import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Laptop, Printer as PrinterIcon } from 'lucide-react-native';

import { AppText, GlassButton, GlassHeader, PressableScale, Screen } from '@/components/ui';
import { ListSkeleton, PanelCard, PanelError, RowDivider, SectionTitle } from '@/components/dashboard/dashboardParts';
import {
  REFRESH_MS,
  clearIntent,
  intentId,
  computerState,
  connectionLabel,
  findNewAgent,
  formatCountdown,
  printerFaultText,
  printingErrorText,
  secondsRemaining,
  sortComputers,
  type Tone,
} from '@/components/printing/printingLogic';
import { ErrorText, Notice, PromptSheet, SmallButton, StaleNote, StatusPill, Tag } from '@/components/printing/printingParts';
import { useBusyKeys } from '@/components/printing/useBusyKeys';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetOrganizerEventsQuery } from '@/store/api/organizerApi';
import {
  useCreatePairingCodeMutation,
  useGetLabelTemplatesQuery,
  useGetPrintAgentsQuery,
  useGetPrintersQuery,
  useRenameAgentMutation,
  useRevokeAgentMutation,
  useTestPrintMutation,
  useUpdatePrinterMutation,
  type LabelTemplate,
  type PrintAgent,
  type Printer,
} from '@/store/api/printingApi';
import { colors } from '@/theme/colors';

const STATUS_KEYS: Record<string, string> = { READY: 'Ready', BUSY: 'Busy', OFFLINE: 'Offline', ERROR: 'Error' };

interface Pairing {
  code: string;
  expiresAt: string;
  knownUuids: Set<string>;
  paired: string | null;
}

type Prompt = { kind: 'rename' | 'revoke'; agent: PrintAgent } | null;

function ToolIcon({ icon: Icon }: { icon: typeof Laptop }) {
  const tint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-black/[0.05] dark:bg-white/10">
      <Icon size={20} color={tint} />
    </View>
  );
}

export default function LabelPrintersScreen() {
  const { t, i18n } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const agentsQuery = useGetPrintAgentsQuery(undefined, { pollingInterval: REFRESH_MS });
  const printersQuery = useGetPrintersQuery(undefined, { pollingInterval: REFRESH_MS });
  const templatesQuery = useGetLabelTemplatesQuery(undefined, { pollingInterval: REFRESH_MS });
  const { data: eventList } = useGetOrganizerEventsQuery({ page: 1, page_size: 200 });
  const [createPairingCode] = useCreatePairingCodeMutation();
  const [renameAgent] = useRenameAgentMutation();
  const [revokeAgent] = useRevokeAgentMutation();
  const [testPrint] = useTestPrintMutation();
  const [updatePrinter] = useUpdatePrinterMutation();
  const testing = useBusyKeys();
  const [archiving, setArchiving] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [refreshing, setRefreshing] = useState(false);

  const agents = agentsQuery.data ?? [];
  const printers = printersQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  useEffect(() => {
    if (!pairing || pairing.paired) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  useEffect(() => {
    if (!pairing || pairing.paired || !agentsQuery.data) return;
    const newAgent = findNewAgent(agentsQuery.data, pairing.knownUuids);
    if (newAgent) setPairing((current) => (current && !current.paired ? { ...current, paired: newAgent.name || newAgent.uuid } : current));
  }, [agentsQuery.data, pairing]);

  const setFieldError = (key: string, message: string | null) => setErrors((current) => ({ ...current, [key]: message }));
  const failureText = (failure: unknown) =>
    printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.');

  const startPairing = async () => {
    setFieldError('pairing', null);
    try {
      const result = await createPairingCode().unwrap();
      const current = await agentsQuery.refetch().unwrap().catch(() => agents);
      setNow(Date.now());
      setPairing({
        code: result.code,
        expiresAt: result.expires_at,
        knownUuids: new Set(current.map((agent) => agent.uuid)),
        paired: null,
      });
    } catch (failure) {
      setFieldError('pairing', printingErrorText(extractApiError(failure), t) || t('Could not create a pairing code. Please try again.'));
    }
  };

  const rename = async (agent: PrintAgent, name: string) => {
    if (!name) return;
    setFieldError(agent.uuid, null);
    try {
      await renameAgent({ uuid: agent.uuid, name }).unwrap();
    } catch (failure) {
      setFieldError(agent.uuid, failureText(failure));
    }
  };

  const revoke = async (agent: PrintAgent) => {
    setFieldError(agent.uuid, null);
    try {
      await revokeAgent(agent.uuid).unwrap();
    } catch (failure) {
      setFieldError(agent.uuid, failureText(failure));
    }
  };

  const runTestPrint = (printer: Printer) => {
    const template = templates[0];
    if (!template) return;
    const key = `test-print:${printer.uuid}`;
    void testing.run(printer.uuid, async () => {
      setFieldError(printer.uuid, null);
      try {
        await testPrint({ uuid: printer.uuid, template_id: template.id, client_request_id: intentId(key) }).unwrap();
      } catch (failure) {
        setFieldError(printer.uuid, failureText(failure));
        return false;
      }
      clearIntent(key);
      toast(t('Test label sent.'), 'success');
      return true;
    });
  };

  const toggleArchive = async (printer: Printer) => {
    setFieldError(printer.uuid, null);
    setArchiving(printer.uuid);
    try {
      await updatePrinter({ uuid: printer.uuid, values: { archived: !printer.archived_at } }).unwrap();
    } catch (failure) {
      setFieldError(printer.uuid, failureText(failure));
    } finally {
      setArchiving(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([agentsQuery.refetch(), printersQuery.refetch(), templatesQuery.refetch()]).catch(() => undefined);
    setRefreshing(false);
  };

  const dateTime = (value: string | null) => {
    if (!value) return t('never');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('never') : format(date, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(i18n.language) });
  };

  const agentOf = (printer: Printer) => agents.find((row) => row.uuid === printer.agent_uuid);
  const printerState = (printer: Printer) => computerState(agentOf(printer));
  const printerRevoked = (printer: Printer) => printerState(printer) === 'revoked';

  const statusLabel = (printer: Printer) => {
    const state = printerState(printer);
    if (state === 'revoked') return t('Computer revoked');
    if (state === 'offline') return t('Offline');
    return t(STATUS_KEYS[printer.status] ?? 'unknown');
  };

  const statusTone = (printer: Printer): Tone => {
    const state = printerState(printer);
    if (state === 'revoked') return 'muted';
    if (state === 'offline' || printer.status === 'OFFLINE') return 'warn';
    if (printer.status === 'READY') return 'ok';
    if (printer.status === 'BUSY') return 'busy';
    if (printer.status === 'ERROR') return 'error';
    return 'muted';
  };

  const statusReason = (printer: Printer) => {
    const state = printerState(printer);
    if (state === 'revoked') return null;
    if (state === 'offline') {
      const agent = agentOf(printer);
      return agent?.last_seen_at ? t('Its computer has not checked in since {{time}}.', { time: dateTime(agent.last_seen_at) }) : null;
    }
    return printerFaultText(printer.status_detail, t) || null;
  };

  const mediaLabel = (printer: Printer) =>
    printer.detected_media_width_mm && printer.detected_media_length_mm
      ? `${printer.detected_media_width_mm} x ${printer.detected_media_length_mm} mm`
      : t('unknown');

  const scopeLabel = (template: LabelTemplate) => {
    if (!template.event_id) return t('All events');
    const event = eventList?.events.find((row) => row.id === template.event_id);
    return event ? event.name : t('Event #{{id}}', { id: template.event_id });
  };

  const sortedPrinters = [...printers.filter((printer) => !printerRevoked(printer)), ...printers.filter(printerRevoked)];
  const secondsLeft = pairing ? secondsRemaining(pairing.expiresAt, now) : 0;
  const loading = agentsQuery.isLoading || printersQuery.isLoading || templatesQuery.isLoading;
  const failed = !agentsQuery.data && !printersQuery.data && (agentsQuery.isError || printersQuery.isError);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Label Printers')} onBack={navigate.back} />
      <ScrollView
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16, gap: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} progressViewOffset={padding.top} />}
      >
        {failed ? (
          <PanelError onRetry={() => void onRefresh()} />
        ) : loading ? (
          <>
            <ListSkeleton rows={3} />
            <ListSkeleton rows={4} />
          </>
        ) : (
          <>
            <View className="gap-3">
              <SectionTitle subtitle={t('Each computer runs the Eventino Print Agent beside its printer.')}>{t('Computers')}</SectionTitle>
              <GlassButton label={t('Pair a computer')} onPress={() => void startPairing()} />
              <ErrorText text={errors.pairing} />
              <StaleNote show={agentsQuery.isError && Boolean(agentsQuery.data)} />
              {pairing ? (
                <PanelCard className="items-center gap-2 py-4">
                  {pairing.paired ? (
                    <AppText className="font-gilroy-bold text-[16px] text-success">{t('Paired: {{name}}', { name: pairing.paired })}</AppText>
                  ) : secondsLeft > 0 ? (
                    <>
                      <AppText selectable className="font-gilroy-bold text-[30px] tracking-[4px]">
                        {pairing.code}
                      </AppText>
                      <AppText className="font-gilroy-semibold text-[14px] text-muted">{formatCountdown(secondsLeft)}</AppText>
                      <AppText className="text-center font-gilroy-medium text-[13px] text-muted">
                        {t('Type this code into the agent page on that computer.')}
                      </AppText>
                    </>
                  ) : (
                    <>
                      <AppText className="font-gilroy-medium text-[14px] text-muted">{t('This code has expired.')}</AppText>
                      <SmallButton label={t('Get a new code')} onPress={() => void startPairing()} />
                    </>
                  )}
                </PanelCard>
              ) : null}
              <PanelCard>
                {sortComputers(agents).map((agent, index) => {
                  const state = computerState(agent);
                  const count = printers.filter((printer) => printer.agent_uuid === agent.uuid).length;
                  return (
                    <RowDivider key={agent.uuid} index={index}>
                      <View className={cn('flex-row gap-3 py-3.5', agent.revoked_at && 'opacity-60')}>
                        <ToolIcon icon={Laptop} />
                        <View className="flex-1 gap-1">
                          <View className="flex-row items-center gap-1.5">
                            <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[15px]">
                              {agent.name}
                            </AppText>
                            {state !== 'online' ? (
                              <StatusPill label={state === 'revoked' ? t('Revoked') : t('Offline')} tone={state === 'revoked' ? 'muted' : 'warn'} />
                            ) : null}
                          </View>
                          <AppText className="font-gilroy-medium text-[12px] text-muted">
                            {t('Last seen')} {dateTime(agent.last_seen_at)} · {t('Printers')}: {count}
                          </AppText>
                          {agent.revoked_at ? null : (
                            <View className="flex-row gap-2 pt-1">
                              <SmallButton label={t('Rename')} onPress={() => setPrompt({ kind: 'rename', agent })} />
                              <SmallButton label={t('Revoke')} onPress={() => setPrompt({ kind: 'revoke', agent })} />
                            </View>
                          )}
                          <ErrorText text={errors[agent.uuid]} />
                        </View>
                      </View>
                    </RowDivider>
                  );
                })}
                {!agents.length ? (
                  <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">{t('No computer is paired yet.')}</AppText>
                ) : null}
              </PanelCard>
            </View>

            <View className="gap-3">
              <SectionTitle subtitle={t('A printer reachable over both USB and Wi-Fi appears twice, once per connection.')}>
                {t('Printers')}
              </SectionTitle>
              <StaleNote show={(printersQuery.isError && Boolean(printersQuery.data)) || (templatesQuery.isError && Boolean(templatesQuery.data))} />
              <PanelCard>
                {sortedPrinters.map((printer, index) => {
                  const revoked = printerRevoked(printer);
                  const reason = statusReason(printer);
                  return (
                    <RowDivider key={printer.uuid} index={index}>
                      <View className={cn('gap-2.5 py-3.5', (printer.archived_at || revoked) && 'opacity-60')}>
                        <View className="flex-row items-center gap-3">
                          <ToolIcon icon={PrinterIcon} />
                          <View className="flex-1 flex-row items-center gap-1.5">
                            <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[15px]">
                              {printer.name}
                            </AppText>
                            <Tag label={connectionLabel(printer.connection_type, t)} />
                          </View>
                          <StatusPill label={statusLabel(printer)} tone={statusTone(printer)} />
                        </View>
                        {reason ? <AppText className="font-gilroy-medium text-[12px]">{reason}</AppText> : null}
                        <View className="flex-row gap-3">
                          <View className="flex-1">
                            <AppText className="font-gilroy-medium text-[11px] text-muted">{t('Labels loaded')}</AppText>
                            <AppText className="font-gilroy-semibold text-[13px]">{mediaLabel(printer)}</AppText>
                          </View>
                          <View className="flex-1">
                            <AppText className="font-gilroy-medium text-[11px] text-muted">{t('Computer')}</AppText>
                            <AppText numberOfLines={1} className="font-gilroy-semibold text-[13px]">
                              {agentOf(printer)?.name ?? t('unknown')}
                            </AppText>
                          </View>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                          {revoked ? null : (
                            <>
                              <SmallButton
                                label={testing.isBusy(printer.uuid) ? t('Printing...') : t('Test print')}
                                disabled={!templates.length || printerState(printer) !== 'online' || testing.isBusy(printer.uuid)}
                                onPress={() => runTestPrint(printer)}
                              />
                              <SmallButton label={t('Settings')} onPress={() => navigate.labelPrinterSettings(printer.uuid)} />
                            </>
                          )}
                          <SmallButton
                            label={printer.archived_at ? t('Unarchive') : t('Archive')}
                            disabled={archiving === printer.uuid}
                            onPress={() => void toggleArchive(printer)}
                          />
                        </View>
                        {!revoked && !templates.length ? <Notice text={t('Create a label layout first.')} /> : null}
                        <ErrorText text={errors[printer.uuid]} />
                      </View>
                    </RowDivider>
                  );
                })}
                {!printers.length ? (
                  <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">{t('No printer has reported in yet.')}</AppText>
                ) : null}
              </PanelCard>
            </View>

            <View className="gap-3">
              <SectionTitle subtitle={t('The preview is drawn by the same code that prints, so this is exactly what comes out.')}>
                {t('Label layouts')}
              </SectionTitle>
              <GlassButton label={t('New layout')} variant="secondary" onPress={() => navigate.labelLayout()} />
              <PanelCard>
                <View className="flex-row justify-between pt-3">
                  <AppText className="font-gilroy-semibold text-[12px] text-muted">{t('Name')}</AppText>
                  <AppText className="font-gilroy-semibold text-[12px] text-muted">{t('Use for')}</AppText>
                </View>
                {templates.map((template) => (
                  <RowDivider key={template.id} index={1}>
                    {template.layout ? (
                      <PressableScale
                        accessibilityLabel={template.name}
                        onPress={() => {
                          haptics.selection();
                          navigate.labelLayout(template.id);
                        }}
                        className="flex-row items-center gap-3 py-3.5"
                      >
                        <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
                          {template.name}
                        </AppText>
                        <AppText numberOfLines={1} className="flex-1 text-right font-gilroy-medium text-[13px] text-muted">
                          {scopeLabel(template)}
                        </AppText>
                      </PressableScale>
                    ) : (
                      <View className="gap-1 py-3.5">
                        <View className="flex-row items-center gap-3">
                          <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[15px]">
                            {template.name}
                          </AppText>
                          <AppText className="font-gilroy-medium text-[13px] text-muted">{scopeLabel(template)}</AppText>
                          <Tag label={t('custom')} />
                        </View>
                        <AppText className="font-gilroy-medium text-[12px] text-muted">
                          {t("This layout was made outside this editor, so it can't be changed here.")}
                        </AppText>
                      </View>
                    )}
                  </RowDivider>
                ))}
                {!templates.length ? (
                  <AppText className="py-4 text-center font-gilroy-medium text-[14px] text-muted">{t('No layouts yet.')}</AppText>
                ) : null}
              </PanelCard>
            </View>
          </>
        )}
      </ScrollView>
      {prompt?.kind === 'rename' ? (
        <PromptSheet
          title={t('Computer name')}
          initialValue={prompt.agent.name}
          confirmLabel={t('Rename')}
          onConfirm={(name) => void rename(prompt.agent, name)}
          onClose={() => setPrompt(null)}
        />
      ) : null}
      {prompt?.kind === 'revoke' ? (
        <PromptSheet
          title={t('Revoke {{name}}? Its printers stop receiving jobs.', { name: prompt.agent.name })}
          confirmLabel={t('Revoke')}
          destructive
          onConfirm={() => void revoke(prompt.agent)}
          onClose={() => setPrompt(null)}
        />
      ) : null}
    </Screen>
  );
}
