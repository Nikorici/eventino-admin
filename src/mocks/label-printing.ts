import type {
  Door,
  DoorPrinter,
  EventPrintSettings,
  FreeLabel,
  JobStatus,
  LabelOverrides,
  ManualJobBody,
  PrintJob,
  TicketSearchResult,
} from '@/store/api/printingApi';

import { agentView, labelSvg, mockAgents, mockPrinters, printerView } from './label-printers';
import { bodyOf, mock, mockError, type MockHandler } from './mock';

const MOCK_USER_ID = 1001;

const settingsByEvent: Record<number, EventPrintSettings> = {
  4101: {
    auto_print_enabled: true,
    review_before_print: true,
    default_printer_uuid: 'printer-zebra-usb',
    default_template_id: 1,
    default_copies: 1,
  },
};

const settingsOf = (eventId: number): EventPrintSettings => {
  settingsByEvent[eventId] ??= {
    auto_print_enabled: false,
    review_before_print: false,
    default_printer_uuid: null,
    default_template_id: null,
    default_copies: 1,
  };
  return settingsByEvent[eventId];
};

interface MockDoor {
  event: number;
  user_id: number;
  name: string;
  email: string;
  assigned_printer_uuid: string | null;
}

const doors: MockDoor[] = [
  { event: 4101, user_id: 2201, name: 'Ion Rusu', email: 'ion.rusu@gmail.com', assigned_printer_uuid: 'printer-zebra-usb' },
  { event: 4101, user_id: 2202, name: 'Maria Ciobanu', email: 'maria.ciobanu@gmail.com', assigned_printer_uuid: 'printer-brother' },
  { event: 4101, user_id: 2203, name: 'Andrei Lungu', email: 'andrei.lungu@gmail.com', assigned_printer_uuid: null },
  { event: 4101, user_id: 2204, name: 'Elena Cojocaru', email: 'elena.cojocaru@gmail.com', assigned_printer_uuid: 'printer-godex' },
  { event: 4102, user_id: 2205, name: 'Vasile Moraru', email: 'vasile.moraru@gmail.com', assigned_printer_uuid: null },
];

const usablePrinter = (uuid: string | null, source: DoorPrinter['source']): DoorPrinter | null => {
  const printer = mockPrinters.find((row) => row.uuid === uuid);
  if (!printer || printer.archived_at) return null;
  const agent = mockAgents.find((row) => row.uuid === printer.agent_uuid);
  if (!agent || !agent.online || agent.revoked_at) return null;
  const view = printerView(printer);
  return {
    uuid: view.uuid,
    name: view.name,
    connection_type: view.connection_type,
    agent_uuid: view.agent_uuid,
    agent_name: view.agent_name,
    agent_revoked_at: view.agent_revoked_at,
    agent_last_seen_at: agentView(agent).last_seen_at,
    source,
  };
};

const doorView = (door: MockDoor): Door => ({
  user_id: door.user_id,
  name: door.name,
  email: door.email,
  assigned_printer_uuid: door.assigned_printer_uuid,
  effective_printer: door.assigned_printer_uuid
    ? usablePrinter(door.assigned_printer_uuid, 'assignment')
    : usablePrinter(settingsOf(door.event).default_printer_uuid, 'default'),
});

interface MockTicket extends TicketSearchResult {
  event: number;
  company: string;
  job_title: string;
}

const tickets: MockTicket[] = [
  ['Ana Popescu', 'VIP Lounge', 'Château Vartely', 'Somelier', true],
  ['Mihai Ceban', 'Abonament 2 zile', 'Purcari', 'Manager vânzări', true],
  ['Irina Bivol', 'Acces o zi', 'Moldcell', 'Marketing', true],
  ['Cristina Botnaru', 'Acces o zi', '', '', true],
  ['Victor Munteanu', 'VIP Lounge', 'Orange Moldova', 'Director', true],
  ['Natalia Grosu', 'Abonament 2 zile', 'Asconi', '', true],
  ['Dumitru Rotaru', 'VIP Lounge', 'Mileștii Mici', 'Enolog', true],
  ['Sergiu Țurcanu', 'Acces o zi', 'Fautor', '', true],
  ['Vlad Sârbu', 'Acces o zi', '', '', true],
  ['Ludmila Cazacu', 'Abonament 2 zile', 'Cricova', 'Ghid', false],
  ['Andreea Popa', 'Acces o zi', 'Maib', 'Analist', false],
  ['Radu Ungureanu', 'VIP Lounge', 'Castel Mimi', 'Fondator', false],
].map(([holder_name, ticket_type, company, job_title, scanned], index) => ({
  id: 880100 + index,
  event: 4101,
  holder_name: String(holder_name),
  ticket_type: String(ticket_type),
  company: String(company),
  job_title: String(job_title),
  scanned: Boolean(scanned),
}));

const ticketByName = (name: string) => tickets.find((ticket) => ticket.holder_name === name);

let jobCounter = 0;

const makeJob = (
  name: string,
  status: JobStatus,
  minutes: number,
  printerUuid: string,
  extra: Partial<PrintJob> = {},
): PrintJob & { event: number } => {
  const ticket = ticketByName(name);
  const printer = mockPrinters.find((row) => row.uuid === printerUuid);
  jobCounter += 1;
  return {
    event: 4101,
    uuid: `job-${jobCounter}`,
    status,
    created_at: new Date(Date.now() - minutes * 60000).toISOString(),
    ticket_id: ticket?.id ?? null,
    ticket_type: ticket?.ticket_type ?? null,
    holder_name: ticket?.holder_name ?? name,
    holder_name_override: false,
    free_label: null,
    label_overrides: null,
    printer_uuid: printerUuid,
    printer_name: printer?.name ?? null,
    connection_type: printer?.connection_type ?? null,
    template_id: 1,
    error_code: null,
    error_detail: null,
    resolved_by_id: null,
    ...extra,
  };
};

const FILLER = ['Ludmila Cazacu', 'Andreea Popa', 'Radu Ungureanu', 'Ana Popescu', 'Mihai Ceban', 'Irina Bivol'];

const jobs: (PrintJob & { event: number })[] = [
  makeJob('Irina Bivol', 'AWAITING_REVIEW', 1, 'printer-zebra-usb'),
  makeJob('Mihai Ceban', 'AWAITING_REVIEW', 2, 'printer-brother'),
  makeJob('Ana Popescu', 'AWAITING_REVIEW', 3, 'printer-zebra-usb'),
  makeJob('Sergiu Țurcanu', 'UNKNOWN', 4, 'printer-zebra-usb', { error_code: 'completion_unconfirmed' }),
  makeJob('Cristina Botnaru', 'PRINTED', 5, 'printer-zebra-usb'),
  makeJob('Victor Munteanu', 'PRINTING', 7, 'printer-zebra-wifi'),
  makeJob('Natalia Grosu', 'FAILED', 9, 'printer-brother', { error_detail: 'printer reports: end_of_media' }),
  makeJob('Dumitru Rotaru', 'PRINTED', 11, 'printer-zebra-usb', { holder_name: 'Dumitru Rotaru', holder_name_override: true }),
  makeJob('Olga Cebotari', 'PRINTED', 13, 'printer-zebra-usb', {
    ticket_id: null,
    holder_name: null,
    free_label: { texts: { name: 'Olga Cebotari', ticket_type: 'Speaker', event_title: 'Festivalul Vinului' } },
  }),
  makeJob('Vlad Sârbu', 'QUEUED', 14, 'printer-zebra-usb'),
  ...Array.from({ length: 18 }, (_, index) =>
    makeJob(FILLER[index % FILLER.length], index % 7 === 3 ? 'CANCELLED' : 'PRINTED', 20 + index * 6, index % 3 ? 'printer-zebra-usb' : 'printer-zebra-wifi'),
  ),
];

const jobView = ({ event: _event, ...job }: PrintJob & { event: number }): PrintJob => job;

const newJob = (source: Partial<PrintJob>, body: { holder_name?: string; label_overrides?: LabelOverrides; free_label?: FreeLabel }) => {
  const created = makeJob(source.holder_name ?? '', 'PRINTED', 0, source.printer_uuid ?? 'printer-zebra-usb', {
    ...source,
    holder_name: body.holder_name ?? source.holder_name ?? null,
    holder_name_override: body.holder_name !== undefined || source.holder_name_override === true,
    label_overrides: body.label_overrides ?? source.label_overrides ?? null,
    free_label: body.free_label ?? source.free_label ?? null,
    status: 'QUEUED',
    error_code: null,
    error_detail: null,
    resolved_by_id: null,
  });
  created.uuid = `job-${Date.now()}-${created.uuid}`;
  created.created_at = new Date().toISOString();
  jobs.unshift(created);
  setTimeout(() => {
    created.status = 'PRINTED';
  }, 6000);
  return jobView(created);
};

const findJob = (uuid: string) => jobs.find((job) => job.uuid === uuid);

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/printing/events/:eventId/settings/', ({ params }) => settingsOf(Number(params.eventId))),
  mock('PATCH', '/api/v1/printing/events/:eventId/settings/', (request) => {
    const settings = settingsOf(Number(request.params.eventId));
    const values = bodyOf<EventPrintSettings>(request);
    if (values.auto_print_enabled && !(values.default_template_id ?? settings.default_template_id)) {
      return mockError(400, { auto_print_enabled: ['auto_print_enabled cannot be on: no default label template'] });
    }
    Object.assign(settings, values);
    return settings;
  }),
  mock('GET', '/api/v1/printing/events/:eventId/doors/', ({ params }) => ({
    doors: doors.filter((door) => door.event === Number(params.eventId)).map(doorView),
  })),
  mock('PUT', '/api/v1/printing/events/:eventId/doors/', (request) => {
    const body = bodyOf<{ user_id: number; printer_uuid: string | null }>(request);
    const door = doors.find((row) => row.event === Number(request.params.eventId) && row.user_id === body.user_id);
    if (!door) return mockError(404, { detail: 'Not found.' });
    door.assigned_printer_uuid = body.printer_uuid ?? null;
    return doorView(door);
  }),
  mock('GET', '/api/v1/printing/jobs/', ({ query }) => {
    const pageSize = Number(query.page_size) || 20;
    const rows = jobs
      .filter((job) => job.event === Number(query.event) && (!query.status || job.status === query.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
    return { results: rows.slice((page - 1) * pageSize, page * pageSize).map(jobView), count: rows.length, page, pages };
  }),
  mock('POST', '/api/v1/printing/jobs/', (request) => {
    const body = bodyOf<ManualJobBody>(request);
    const ticket = tickets.find((row) => row.id === body.ticket_id);
    const printer = mockPrinters.find((row) => row.uuid === body.printer_uuid);
    return newJob(
      {
        ticket_id: ticket?.id ?? null,
        ticket_type: ticket?.ticket_type ?? null,
        holder_name: ticket?.holder_name ?? null,
        printer_uuid: body.printer_uuid,
        printer_name: printer?.name ?? null,
        connection_type: printer?.connection_type ?? null,
        template_id: body.template_id,
      },
      body,
    );
  }),
  mock('POST', '/api/v1/printing/jobs/:uuid/reprint/', (request) => {
    const job = findJob(request.params.uuid);
    if (!job) return mockError(404, { detail: 'Not found.' });
    return newJob(job, bodyOf<{ holder_name?: string; label_overrides?: LabelOverrides; free_label?: FreeLabel }>(request));
  }),
  mock('POST', '/api/v1/printing/jobs/:uuid/approve/', (request) => {
    const job = findJob(request.params.uuid);
    if (!job) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<{ holder_name?: string; label_overrides?: LabelOverrides }>(request);
    if (body.holder_name !== undefined) {
      job.holder_name = body.holder_name;
      job.holder_name_override = true;
    }
    if (body.label_overrides) job.label_overrides = body.label_overrides;
    job.status = 'QUEUED';
    setTimeout(() => {
      job.status = 'PRINTED';
    }, 6000);
    return jobView(job);
  }),
  mock('POST', '/api/v1/printing/jobs/:uuid/cancel/', ({ params }) => {
    const job = findJob(params.uuid);
    if (!job) return mockError(404, { detail: 'Not found.' });
    job.status = 'CANCELLED';
    return jobView(job);
  }),
  mock('POST', '/api/v1/printing/jobs/:uuid/resolve/', (request) => {
    const job = findJob(request.params.uuid);
    if (!job) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<{ action: string; holder_name?: string; label_overrides?: LabelOverrides }>(request);
    job.resolved_by_id = MOCK_USER_ID;
    if (body.action === 'mark_printed') {
      job.status = 'PRINTED';
      return jobView(job);
    }
    return newJob(job, body);
  }),
  mock('GET', '/api/v1/printing/label-data/', ({ query }) => {
    if (query.ticket) {
      const ticket = tickets.find((row) => row.id === Number(query.ticket));
      if (!ticket) return mockError(404, { detail: 'Not found.' });
      return {
        holder_name: ticket.holder_name ?? '',
        company: ticket.company,
        job_title: ticket.job_title,
        ticket_type: ticket.ticket_type ?? '',
        event_title: 'Festivalul Vinului — Ediția de Toamnă',
        custom: '',
        lines: ['name', 'ticket_type', 'company', 'event_title'],
        has_qr: true,
        template_id: Number(query.template) || 1,
      };
    }
    return {
      event_title: 'Festivalul Vinului — Ediția de Toamnă',
      custom: '',
      lines: ['name', 'ticket_type', 'company', 'event_title'],
      has_qr: true,
      template_id: Number(query.template) || 1,
    };
  }),
  mock('POST', '/api/v1/printing/label-preview/', (request) => {
    const body = bodyOf<{ ticket_id: number; holder_name?: string; label_overrides?: LabelOverrides; free_label?: FreeLabel }>(request);
    if (body.free_label) {
      const texts = body.free_label.texts ?? {};
      const hidden = body.free_label.hidden ?? [];
      const lines = ['name', 'ticket_type', 'company', 'event_title'].filter((key) => !hidden.includes(key)).map((key) => texts[key] ?? '');
      if (!lines.some((line) => line.trim()) && !body.free_label.qr_value) {
        return mockError(400, { detail: 'Nothing would be printed on this label.' });
      }
      return labelSvg(lines, { qr: Boolean(body.free_label.qr_value) });
    }
    const ticket = tickets.find((row) => row.id === body.ticket_id);
    const texts: Record<string, string> = {
      name: body.holder_name ?? ticket?.holder_name ?? '',
      ticket_type: ticket?.ticket_type ?? '',
      company: ticket?.company ?? '',
      event_title: 'Festivalul Vinului',
      ...(body.label_overrides?.texts ?? {}),
    };
    const hidden = body.label_overrides?.hidden ?? [];
    const lines = ['name', 'ticket_type', 'company', 'event_title'].filter((key) => !hidden.includes(key)).map((key) => texts[key]);
    return labelSvg(lines, { qr: !hidden.includes('qr') });
  }),
  mock('GET', '/api/v1/printing/events/:eventId/tickets/', ({ params, query }) => {
    const needle = (query.q ?? '').toLowerCase();
    return {
      results: tickets
        .filter((ticket) => ticket.event === Number(params.eventId))
        .filter((ticket) => (ticket.holder_name ?? '').toLowerCase().includes(needle) || String(ticket.id).includes(needle))
        .slice(0, 8)
        .map(({ id, holder_name, ticket_type, scanned }) => ({ id, holder_name, ticket_type, scanned })),
    };
  }),
];
