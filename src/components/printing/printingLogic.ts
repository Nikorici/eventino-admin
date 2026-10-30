import type {
  Door,
  EventPrintSettings,
  FreeLabel,
  JobStatus,
  LabelData,
  LabelOverrides,
  PrintAgent,
  Printer,
  PrinterRef,
  PrintJob,
} from '@/store/api/printingApi';

export type Translate = (key: string, options?: Record<string, string | number>) => string;

export type ComputerState = 'online' | 'offline' | 'revoked';
export type PrinterProblem = ComputerState | 'archived' | 'missing' | null;

export const OFFLINE_AFTER_MS = 120000;
export const REFRESH_MS = 5000;
export const ACTION_COOLDOWN_MS = 2000;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function computerState(agent: Pick<PrintAgent, 'revoked_at' | 'last_seen_at'> | null | undefined, now = Date.now()): ComputerState {
  if (!agent) return 'offline';
  if (agent.revoked_at) return 'revoked';
  if (!agent.last_seen_at) return 'offline';
  const seen = new Date(agent.last_seen_at).getTime();
  if (Number.isNaN(seen) || now - seen > OFFLINE_AFTER_MS) return 'offline';
  return 'online';
}

export function sortComputers(agents: PrintAgent[]): PrintAgent[] {
  return [...agents.filter((agent) => !agent.revoked_at), ...agents.filter((agent) => agent.revoked_at)];
}

export function secondsRemaining(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, '0')}`;
}

export function findNewAgent(agents: PrintAgent[], knownUuids: Set<string>): PrintAgent | null {
  return agents.find((agent) => agent.uuid && !knownUuids.has(agent.uuid)) ?? null;
}

const CONNECTION_LABELS: Record<string, string> = { USB: 'USB', NETWORK: 'Wi-Fi' };

export function connectionLabel(connection: string | null | undefined, t: Translate): string {
  return connection === 'NETWORK' ? t('Wi-Fi') : t('USB');
}

export function printerAgent(printer: PrinterRef, agents: PrintAgent[] = []): Pick<PrintAgent, 'name' | 'revoked_at' | 'last_seen_at'> | null {
  const known = agents.find((row) => row.uuid === printer.agent_uuid);
  if (known) return known;
  if (!printer.agent_name && !printer.agent_revoked_at && !printer.agent_last_seen_at) return null;
  return {
    name: printer.agent_name ?? '',
    revoked_at: printer.agent_revoked_at ?? null,
    last_seen_at: printer.agent_last_seen_at ?? null,
  };
}

export function printerLabel(printer: PrinterRef, t: Translate, agents: PrintAgent[] = []): string {
  const connection = printer.connection_type ? CONNECTION_LABELS[printer.connection_type] : undefined;
  const base = connection ? `${printer.name} — ${t(connection)}` : printer.name;
  const agent = printerAgent(printer, agents);
  return agent?.name ? `${base} · ${agent.name}` : base;
}

export function printerProblem(printer: Printer | undefined, agents: PrintAgent[] = []): PrinterProblem {
  if (!printer) return 'missing';
  if (printer.archived_at) return 'archived';
  const agent = printerAgent(printer, agents);
  if (!agent) return null;
  const state = computerState(agent);
  return state === 'online' ? null : state;
}

export function offeredPrinters(printers: Printer[], agents: PrintAgent[] = []): Printer[] {
  return printers.filter((printer) => {
    const problem = printerProblem(printer, agents);
    return problem !== 'archived' && problem !== 'revoked';
  });
}

export function defaultPrinterProblem(
  settings: EventPrintSettings | undefined,
  printers: Printer[],
  agents: PrintAgent[] = [],
): PrinterProblem {
  if (!settings?.default_printer_uuid) return null;
  return printerProblem(
    printers.find((printer) => printer.uuid === settings.default_printer_uuid),
    agents,
  );
}

const DEFAULT_WARNINGS: Record<string, string> = {
  revoked: "The default printer's computer is revoked — choose another printer.",
  offline: "The default printer's computer is offline — choose another printer.",
  archived: 'The default printer is archived — choose another printer.',
  missing: 'The default printer is no longer available — choose another printer.',
};

export function defaultPrinterWarning(problem: PrinterProblem, t: Translate): string | null {
  return problem && DEFAULT_WARNINGS[problem] ? t(DEFAULT_WARNINGS[problem]) : null;
}

const UNAVAILABLE_LABELS: Record<string, string> = {
  revoked: 'Unavailable printer (computer revoked)',
  archived: 'Unavailable printer (archived)',
};

export function unavailablePrinterLabel(uuid: string, printers: Printer[], agents: PrintAgent[], t: Translate): string {
  const problem = printerProblem(
    printers.find((printer) => printer.uuid === uuid),
    agents,
  );
  return t((problem && UNAVAILABLE_LABELS[problem]) || 'Unavailable printer');
}

const NOTHING_PRINTS_REASONS: Record<string, string> = {
  none: 'No label will print: this event has no default printer.',
  revoked: "No label will print: the default printer's computer is revoked.",
  offline: "No label will print: the default printer's computer is offline.",
  archived: 'No label will print: the default printer is archived.',
  missing: 'No label will print: the default printer is no longer available.',
};

export function effectiveLabel(
  door: Door,
  t: Translate,
  { agents = [], defaultProblem = null, hasDefault = true }: { agents?: PrintAgent[]; defaultProblem?: PrinterProblem; hasDefault?: boolean } = {},
): string {
  if (!door.effective_printer) {
    if (door.assigned_printer_uuid) return t('No label will print');
    const reason = hasDefault ? defaultProblem : 'none';
    return t((reason && NOTHING_PRINTS_REASONS[reason]) || 'No label will print');
  }
  if (door.effective_printer.source === 'default') {
    return `${printerLabel(door.effective_printer, t, agents)} (${t('event default')})`;
  }
  return printerLabel(door.effective_printer, t, agents);
}

export function doorWarnings(doors: Door[], settings: EventPrintSettings | undefined, t: Translate): string[] {
  const warnings = doors
    .filter((door) => door.assigned_printer_uuid && !door.effective_printer)
    .map((door) => t('{{name}} is assigned to a printer that is archived or offline, so its scans print nothing.', { name: door.name }));
  if (!settings?.auto_print_enabled) return warnings;
  doors
    .filter((door) => !door.assigned_printer_uuid && !door.effective_printer)
    .forEach((door) => warnings.push(t('{{name}} has no printer, so its scans print nothing.', { name: door.name })));
  const assigned = doors.filter((door) => door.effective_printer?.source === 'assignment');
  const onDefault = doors.filter((door) => door.effective_printer?.source === 'default');
  if (assigned.length && onDefault.length) {
    onDefault.forEach((door) => warnings.push(t('{{name}} still prints at the event default.', { name: door.name })));
  }
  return warnings;
}

const FAULT_SENTENCES: Record<string, string> = {
  'cover open': 'The cover is open.',
  'no media': 'No labels are loaded.',
  'media empty': 'No labels are loaded.',
  'media needed': 'No labels are loaded.',
  'end of media': 'The label roll has run out.',
  'replace media': 'The labels need to be replaced.',
  'cutter jam': 'The cutter is jammed.',
  'media jam': 'The labels are jammed.',
  'cannot feed': 'The printer cannot feed labels.',
  'printer off': 'The printer is turned off.',
  'printer in use': 'The printer is busy with another job.',
  'communication error': 'The printer reports a communication error.',
  'system error': 'The printer reports a system error.',
};

const faultKey = (part: string) =>
  part
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/ (error|warning|report)$/, '');

export function printerFaultText(detail: string | null | undefined, t: Translate): string {
  if (!detail) return '';
  return detail
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const sentence = FAULT_SENTENCES[faultKey(part)];
      return sentence ? t(sentence) : part;
    })
    .join(' ');
}

const EXACT_SENTENCES: Record<string, string> = {
  'printer is archived or its agent is revoked': 'This printer is archived or its computer is revoked. Choose another printer.',
  'no label layout is set for this event; choose one': 'This event has no label layout. Choose one first.',
  'the logo must be 200 KB or smaller': 'The logo must be 200 KB or smaller.',
  'the logo must be a PNG, JPEG, GIF or WebP image': 'The logo must be a PNG or JPG file.',
  'logo must be base64-encoded image data': 'The logo must be a PNG or JPG file.',
  'the logo image is too large; use one under 6000 x 6000 pixels': 'The logo image is too large. Use one under 6000 x 6000 pixels.',
  'Nothing would be printed on this label.': 'Nothing would be printed on this label.',
};

const BLOCKER_SENTENCES: [string, string][] = [
  ['no default label template', 'Choose a label layout before turning printing on.'],
  ['no default printer', 'Choose a default printer or a printer for a door before turning printing on.'],
];

const QR_TOO_SMALL = /^the QR code would be ([\d.]+) mm wide, too small to scan/;
const MEDIA_MISMATCH = /^printer has (\d+x\d+) mm loaded, job needs (\d+x\d+) mm$/;

export function printingErrorText(message: string | null | undefined, t: Translate): string | undefined {
  if (!message) return undefined;
  const text = message.trim();
  if (EXACT_SENTENCES[text]) return t(EXACT_SENTENCES[text]);
  if (text.startsWith('the text does not fit on this label')) {
    return t('The text does not fit on this label. Remove a line, make the QR code smaller, or move it.');
  }
  const qr = QR_TOO_SMALL.exec(text);
  if (qr) {
    return t(
      'The QR code would be {{size}} mm wide, too small to scan on this label. Make it larger, move it, or show fewer lines.',
      { size: qr[1] },
    );
  }
  const media = MEDIA_MISMATCH.exec(text);
  if (media) {
    return t('The printer has {{loaded}} mm labels loaded, but this label needs {{needed}} mm.', {
      loaded: media[1].replace('x', ' x '),
      needed: media[2].replace('x', ' x '),
    });
  }
  if (text.startsWith('auto_print_enabled cannot be on:')) {
    const sentences = BLOCKER_SENTENCES.filter(([marker]) => text.includes(marker)).map(([, sentence]) => t(sentence));
    if (sentences.length) return sentences.join(' ');
  }
  return message;
}

const CODE_SENTENCES: Record<string, string> = {
  agent_restarted: 'The print agent restarted during this label.',
  completion_unconfirmed: 'The printer did not confirm the label came out.',
};

const PRINTER_REPORTS = 'printer reports:';

export function jobReason(job: PrintJob, t: Translate): string {
  if (job.status === 'PRINTED') return '';
  const code = job.error_code ?? '';
  const detail = (job.error_detail ?? '').trim();
  if (CODE_SENTENCES[code]) return t(CODE_SENTENCES[code]);
  if (detail.toLowerCase().startsWith(PRINTER_REPORTS)) return printerFaultText(detail.slice(PRINTER_REPORTS.length), t);
  return printingErrorText(detail, t) || code;
}

export function splitByPrinter<T extends { printer_uuid: string | null }>(jobs: T[], printerUuid: string) {
  if (!printerUuid) return { shown: jobs, hidden: 0 };
  const shown = jobs.filter((job) => job.printer_uuid === printerUuid);
  return { shown, hidden: jobs.length - shown.length };
}

export const JOB_STATUSES: JobStatus[] = [
  'AWAITING_REVIEW',
  'QUEUED',
  'CLAIMED',
  'PRINTING',
  'PRINTED',
  'FAILED',
  'UNKNOWN',
  'CANCELLED',
];

export const REPRINTABLE: JobStatus[] = ['PRINTED', 'FAILED', 'CANCELLED'];

export type Tone = 'ok' | 'error' | 'warn' | 'muted' | 'busy';

export const TONE_COLORS: Record<Tone, string> = {
  ok: '#34c759',
  error: '#d83636',
  warn: '#f97316',
  muted: '#8a8d93',
  busy: '#61859d',
};

const JOB_TONES: Partial<Record<JobStatus, Tone>> = {
  PRINTED: 'ok',
  FAILED: 'error',
  UNKNOWN: 'warn',
  CANCELLED: 'muted',
};

export const jobTone = (status: JobStatus): Tone => JOB_TONES[status] ?? 'busy';

export const isFreeLabel = (job: PrintJob) =>
  job.ticket_id == null && Boolean(job.free_label) && Object.keys(job.free_label ?? {}).length > 0;

export const jobHolderName = (job: PrintJob) =>
  job.holder_name || (isFreeLabel(job) ? job.free_label?.texts?.name : '') || '';

export const jobTicketType = (job: PrintJob) =>
  (isFreeLabel(job) ? job.free_label?.texts?.ticket_type : job.ticket_type) || '';

const intents = new Map<string, string>();

const newId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });

export function intentId(key: string): string {
  const existing = intents.get(key);
  if (existing) return existing;
  const created = newId();
  intents.set(key, created);
  return created;
}

export function clearIntent(key: string): void {
  intents.delete(key);
}

export const TEXT_KEYS = ['company', 'job_title', 'ticket_type', 'event_title', 'custom'] as const;
export type TextKey = (typeof TEXT_KEYS)[number];
export const HIDEABLE = ['name', 'ticket_type', 'company', 'job_title', 'event_title', 'custom', 'qr'];
export const FREE_HIDEABLE = HIDEABLE.filter((key) => key !== 'qr');
export const TEXT_MAX = 255;
export const CUSTOM_MAX = 40;
export const QR_VALUE_MAX = 500;

export interface EditorValues {
  name: string;
  texts: Record<TextKey, string>;
  hidden: string[];
  qrOn: boolean;
  qrValue: string;
}

export interface LabelChanges {
  holderName?: string;
  labelOverrides?: LabelOverrides;
  freeLabel?: FreeLabel;
}

const ticketTexts = (data: Partial<LabelData>): Record<TextKey, string> => ({
  company: data.company ?? '',
  job_title: data.job_title ?? '',
  ticket_type: data.ticket_type ?? '',
  event_title: data.event_title ?? '',
  custom: data.custom ?? '',
});

export function startingValues(data: LabelData, initialHolderName?: string, initialOverrides?: LabelOverrides | null): EditorValues {
  return {
    name: initialHolderName === undefined ? data.holder_name ?? '' : initialHolderName,
    texts: { ...ticketTexts(data), ...(initialOverrides?.texts ?? {}) },
    hidden: HIDEABLE.filter((key) => (initialOverrides?.hidden ?? []).includes(key)),
    qrOn: false,
    qrValue: '',
  };
}

export function overridesFrom(data: LabelData, texts: Record<TextKey, string>, hidden: string[]): LabelOverrides {
  const changed: Record<string, string> = {};
  TEXT_KEYS.forEach((key) => {
    if ((texts[key] || '') !== (data[key] || '')) changed[key] = texts[key] || '';
  });
  const overrides: LabelOverrides = {};
  if (Object.keys(changed).length) overrides.texts = changed;
  const hiddenKeys = HIDEABLE.filter((key) => hidden.includes(key));
  if (hiddenKeys.length) overrides.hidden = hiddenKeys;
  return overrides;
}

export function freeStartingValues(data: LabelData, initialFreeLabel?: FreeLabel): EditorValues {
  if (!initialFreeLabel) {
    return {
      name: '',
      texts: { ...ticketTexts({}), event_title: data.event_title ?? '', custom: data.custom ?? '' },
      hidden: [],
      qrOn: false,
      qrValue: '',
    };
  }
  const texts = initialFreeLabel.texts ?? {};
  const hidden = initialFreeLabel.hidden ?? [];
  const qrValue = initialFreeLabel.qr_value ?? '';
  return {
    name: texts.name ?? '',
    texts: ticketTexts(texts),
    hidden: FREE_HIDEABLE.filter((key) => hidden.includes(key)),
    qrOn: Boolean(qrValue.trim()) && !hidden.includes('qr'),
    qrValue,
  };
}

export function freeLabelFrom(values: EditorValues): FreeLabel {
  const texts = Object.fromEntries(
    [['name', values.name] as const, ...TEXT_KEYS.map((key) => [key, values.texts[key]] as const)].filter(([, text]) =>
      (text || '').trim(),
    ),
  );
  const freeLabel: FreeLabel = {};
  if (Object.keys(texts).length) freeLabel.texts = texts;
  const hiddenKeys = FREE_HIDEABLE.filter((key) => values.hidden.includes(key));
  if (hiddenKeys.length) freeLabel.hidden = hiddenKeys;
  if (values.qrOn && values.qrValue.trim()) freeLabel.qr_value = values.qrValue;
  return freeLabel;
}

export function freeLabelChanges(start: EditorValues, current: EditorValues, isReprint: boolean): LabelChanges {
  const freeLabel = freeLabelFrom(current);
  if (isReprint && JSON.stringify(freeLabel) === JSON.stringify(freeLabelFrom(start))) return {};
  return { freeLabel };
}

export function labelChanges(data: LabelData, start: EditorValues, current: EditorValues): LabelChanges {
  const changes: LabelChanges = {};
  if (current.name !== start.name) changes.holderName = current.name;
  const overrides = overridesFrom(data, current.texts, current.hidden);
  if (JSON.stringify(overrides) !== JSON.stringify(overridesFrom(data, start.texts, start.hidden))) {
    changes.labelOverrides = overrides;
  }
  return changes;
}

export function editsBody(changes: LabelChanges): { holder_name?: string; label_overrides?: LabelOverrides } {
  return {
    ...(changes.holderName === undefined ? {} : { holder_name: changes.holderName }),
    ...(changes.labelOverrides === undefined ? {} : { label_overrides: changes.labelOverrides }),
  };
}
