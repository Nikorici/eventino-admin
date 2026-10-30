import type {
  LabelLayout,
  LabelTemplate,
  PrintAgent,
  Printer,
  PrinterUpdate,
} from '@/store/api/printingApi';

import { bodyOf, mock, mockError, type MockHandler } from './mock';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

interface MockAgent extends PrintAgent {
  online: boolean;
}

export const mockAgents: MockAgent[] = [
  { uuid: 'agent-desk-a', name: 'Desk A laptop', last_seen_at: null, revoked_at: null, online: true },
  { uuid: 'agent-desk-b', name: 'Desk B laptop', last_seen_at: null, revoked_at: null, online: true },
  { uuid: 'agent-back-office', name: 'Back office PC', last_seen_at: minutesAgo(15 * 60 + 26), revoked_at: null, online: false },
  { uuid: 'agent-old-desk', name: 'Old ticket desk', last_seen_at: minutesAgo(47 * 24 * 60), revoked_at: minutesAgo(46 * 24 * 60), online: false },
];

export const agentView = (agent: MockAgent): PrintAgent => ({
  uuid: agent.uuid,
  name: agent.name,
  last_seen_at: agent.online ? minutesAgo(0.3) : agent.last_seen_at,
  revoked_at: agent.revoked_at,
});

const basePrinter = {
  status_detail: null,
  override_kind: null,
  override_width_mm: null,
  override_height_mm: null,
  orientation: 'AUTO' as const,
  rotation_deg: 0,
  margin_left_mm: 0,
  margin_right_mm: 0,
  margin_top_mm: 0,
  margin_bottom_mm: 0,
  archived_at: null,
};

export const mockPrinters: Printer[] = [
  {
    ...basePrinter,
    uuid: 'printer-zebra-usb',
    name: 'Zebra ZD421',
    connection_type: 'USB',
    agent_uuid: 'agent-desk-a',
    status: 'READY',
    detected_media_kind: 'DIE_CUT',
    detected_media_width_mm: 58,
    detected_media_length_mm: 80,
  },
  {
    ...basePrinter,
    uuid: 'printer-zebra-wifi',
    name: 'Zebra ZD421',
    connection_type: 'NETWORK',
    agent_uuid: 'agent-desk-a',
    status: 'BUSY',
    detected_media_kind: 'DIE_CUT',
    detected_media_width_mm: 58,
    detected_media_length_mm: 80,
  },
  {
    ...basePrinter,
    uuid: 'printer-brother',
    name: 'Brother QL-820NWB',
    connection_type: 'USB',
    agent_uuid: 'agent-desk-b',
    status: 'ERROR',
    status_detail: 'end_of_media',
    detected_media_kind: 'DIE_CUT',
    detected_media_width_mm: 62,
    detected_media_length_mm: 100,
  },
  {
    ...basePrinter,
    uuid: 'printer-godex',
    name: 'Godex RT200',
    connection_type: 'USB',
    agent_uuid: 'agent-back-office',
    status: 'OFFLINE',
    detected_media_kind: 'DIE_CUT',
    detected_media_width_mm: 50,
    detected_media_length_mm: 30,
  },
  {
    ...basePrinter,
    uuid: 'printer-zebra-old',
    name: 'Zebra GK420d',
    connection_type: 'USB',
    agent_uuid: 'agent-old-desk',
    status: 'OFFLINE',
    detected_media_kind: null,
    detected_media_width_mm: null,
    detected_media_length_mm: null,
  },
];

export const printerView = (printer: Printer): Printer => {
  const agent = mockAgents.find((row) => row.uuid === printer.agent_uuid);
  return {
    ...printer,
    agent_name: agent?.name ?? null,
    agent_revoked_at: agent?.revoked_at ?? null,
    agent_last_seen_at: agent ? agentView(agent).last_seen_at : null,
  };
};

interface MockTemplate extends LabelTemplate {
  logo?: string;
}

export const mockTemplates: MockTemplate[] = [
  {
    id: 1,
    name: 'Festival badge',
    event_id: 4101,
    has_logo: true,
    layout: { preset: 'name_type_qr', fields: ['name', 'ticket_type', 'event_title', 'qr'], text_size: 'L', qr_source: 'conecta', logo: 'top' },
  },
  {
    id: 2,
    name: 'Name + QR',
    event_id: null,
    has_logo: false,
    layout: { preset: 'name_company_qr', fields: ['name', 'company', 'qr'], text_size: 'M', qr_source: 'ticket' },
  },
  { id: 3, name: 'Staff pass', event_id: null, has_logo: false, layout: null },
];

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SAMPLE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="32" fill="#2b3a44"/><text x="80" y="104" font-size="72" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">E</text></svg>',
)}`;

export function labelSvg(lines: string[], { qr = true, width = 640, height = 400 } = {}): string {
  const textWidth = qr ? width - 220 : width - 40;
  const rows = lines
    .filter((line) => line.trim())
    .slice(0, 5)
    .map((line, index) => {
      const size = index === 0 ? 44 : 26;
      const y = 80 + (index === 0 ? 0 : 30 + index * 42);
      return `<text x="28" y="${y}" font-size="${size}" font-family="Arial" font-weight="${index === 0 ? 700 : 400}" fill="#111" textLength="${Math.min(textWidth, line.length * size * 0.55)}">${escapeXml(line)}</text>`;
    })
    .join('');
  const cells = qr
    ? Array.from({ length: 49 }, (_, index) => {
        const filled = (index * 7 + Math.floor(index / 7) * 3) % 5 < 2 || index % 8 === 0;
        return filled ? `<rect x="${width - 190 + (index % 7) * 24}" y="${110 + Math.floor(index / 7) * 24}" width="24" height="24" fill="#111"/>` : '';
      }).join('')
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/>${rows}${cells}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const FIELD_SAMPLES: Record<string, string> = {
  name: 'Ana Popescu',
  ticket_type: 'VIP Lounge',
  company: 'Château Vartely',
  job_title: 'Somelier',
  event_title: 'Festivalul Vinului',
};

const nextId = () => Math.max(0, ...mockTemplates.map((template) => template.id)) + 1;

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/printing/agents/', () => mockAgents.map(agentView)),
  mock('POST', '/api/v1/printing/agents/pairing-code/', () => {
    setTimeout(() => {
      if (!mockAgents.some((agent) => agent.uuid === 'agent-entrance')) {
        mockAgents.splice(2, 0, { uuid: 'agent-entrance', name: 'Entrance tablet', last_seen_at: null, revoked_at: null, online: true });
      }
    }, 9000);
    return { code: 'K7QM-42TX', expires_at: new Date(Date.now() + 10 * 60000).toISOString() };
  }),
  mock('PATCH', '/api/v1/printing/agents/:uuid/', (request) => {
    const agent = mockAgents.find((row) => row.uuid === request.params.uuid);
    if (!agent) return mockError(404, { detail: 'Not found.' });
    agent.name = bodyOf<{ name: string }>(request).name ?? agent.name;
    return agentView(agent);
  }),
  mock('POST', '/api/v1/printing/agents/:uuid/revoke/', ({ params }) => {
    const agent = mockAgents.find((row) => row.uuid === params.uuid);
    if (!agent) return mockError(404, { detail: 'Not found.' });
    agent.revoked_at = new Date().toISOString();
    agent.last_seen_at = agentView(agent).last_seen_at;
    agent.online = false;
    return agentView(agent);
  }),
  mock('GET', '/api/v1/printing/printers/', () => mockPrinters.map(printerView)),
  mock('PATCH', '/api/v1/printing/printers/:uuid/', (request) => {
    const printer = mockPrinters.find((row) => row.uuid === request.params.uuid);
    if (!printer) return mockError(404, { detail: 'Not found.' });
    const { archived, ...values } = bodyOf<PrinterUpdate>(request);
    Object.assign(printer, values);
    if (archived !== undefined) printer.archived_at = archived ? new Date().toISOString() : null;
    return printerView(printer);
  }),
  mock('POST', '/api/v1/printing/printers/:uuid/test/', ({ params }) => {
    const printer = mockPrinters.find((row) => row.uuid === params.uuid);
    if (!printer) return mockError(404, { detail: 'Not found.' });
    if (printer.status === 'ERROR') return mockError(400, { detail: 'printer has 62x100 mm loaded, job needs 58x80 mm' });
    return { uuid: `test-${Date.now()}`, status: 'QUEUED' };
  }),
  mock('GET', '/api/v1/printing/templates/', ({ query }) =>
    mockTemplates
      .filter((template) => !query.event || template.event_id == null || template.event_id === Number(query.event))
      .map(({ logo: _logo, ...template }) => template),
  ),
  mock('POST', '/api/v1/printing/templates/', (request) => {
    const body = bodyOf<{ name: string; layout: LabelLayout; event_id: number | null }>(request);
    const created: MockTemplate = {
      id: nextId(),
      name: body.name ?? '',
      event_id: body.event_id ?? null,
      layout: body.layout ?? null,
      has_logo: false,
    };
    mockTemplates.push(created);
    return created;
  }),
  mock('POST', '/api/v1/printing/templates/preview/', (request) => {
    const body = bodyOf<{ layout: LabelLayout }>(request);
    const fields = body.layout?.fields ?? ['name'];
    const lines = fields
      .filter((field) => field !== 'qr')
      .map((field) => (field === 'custom' ? body.layout?.custom_text ?? '' : FIELD_SAMPLES[field] ?? ''));
    return labelSvg(lines, { qr: fields.includes('qr') });
  }),
  mock('PATCH', '/api/v1/printing/templates/:id/', (request) => {
    const template = mockTemplates.find((row) => row.id === Number(request.params.id));
    if (!template) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<{ name: string; layout: LabelLayout }>(request);
    template.name = body.name ?? template.name;
    template.layout = body.layout ?? template.layout;
    return template;
  }),
  mock('GET', '/api/v1/printing/templates/:id/logo/', ({ params }) => {
    const template = mockTemplates.find((row) => row.id === Number(params.id));
    if (!template?.has_logo) return mockError(404, { detail: 'Not found.' });
    return template.logo ?? SAMPLE_LOGO;
  }),
  mock('POST', '/api/v1/printing/templates/:id/logo/', ({ params }) => {
    const template = mockTemplates.find((row) => row.id === Number(params.id));
    if (!template) return mockError(404, { detail: 'Not found.' });
    template.has_logo = true;
    return template;
  }),
  mock('DELETE', '/api/v1/printing/templates/:id/logo/', ({ params }) => {
    const template = mockTemplates.find((row) => row.id === Number(params.id));
    if (!template) return mockError(404, { detail: 'Not found.' });
    template.has_logo = false;
    return {};
  }),
];
