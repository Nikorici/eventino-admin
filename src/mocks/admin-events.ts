import type { StaffEvent, StaffEventCoupon } from '@/store/api/adminApi';
import type {
  AccountingCompany,
  AccountingSettingsPatch,
  EventAccounting,
  EventTransfer,
  TransferBody,
} from '@/store/api/accountingApi';

import { currentMockUser, findMockEvent, mockEvents, mockUsers, type MockEvent } from './core';
import { bodyOf, isoDate, isoDateTime, mock, MockError, mockError, type MockHandler, type MockRequest } from './mock';

const PAGE_SIZE = 25;

const COUPONS: Record<number, StaffEventCoupon[]> = {
  4101: [
    { code: 'TOAMNA20', discount: '20%', usage_count: 37 },
    { code: 'VIPVIN15', discount: '15%', usage_count: 12 },
  ],
  4103: [{ code: 'EARLY10', discount: '10%', usage_count: 64 }],
  4201: [{ code: 'JAZZ10', discount: '10%', usage_count: 18 }],
  4301: [
    { code: 'UNTOLD20', discount: '20%', usage_count: 140 },
    { code: 'CLUJ15', discount: '15%', usage_count: 55 },
  ],
};

const paymentDone: Record<number, boolean> = { 4105: true };

const COMPANIES: Record<number, AccountingCompany | null> = {
  1001: {
    id: 301,
    name: 'Sunset Events SRL',
    cui: '1019600034821',
    registration_number: 'MD-0412/2019',
    address: 'str. Mihai Eminescu 50',
    city: 'Chișinău',
    county: null,
    postal_code: 'MD-2012',
    country_code: 'MD',
    email: 'office@sunsetevents.md',
    phone: '+37369123456',
    iban: 'MD24AG000225100013104168',
    pays_tva: false,
    tva_percent: null,
  },
  1002: null,
  1003: {
    id: 303,
    name: 'Cluj Live Events SRL',
    cui: 'RO41236758',
    registration_number: 'J12/3456/2019',
    address: 'str. Memorandumului 28',
    city: 'Cluj-Napoca',
    county: 'Cluj',
    postal_code: '400114',
    country_code: 'RO',
    email: 'contabilitate@clujlive.ro',
    phone: '+40744123456',
    iban: 'RO49BTRLRONCRT0512345601',
    pays_tva: true,
    tva_percent: 19,
  },
};

function ownerOf(event: MockEvent) {
  return mockUsers.find((user) => user.id === event.ownerId);
}

function ownerName(event: MockEvent): string {
  const owner = ownerOf(event);
  if (!owner) return '';
  return owner.organization_name || `${owner.first_name} ${owner.last_name}`.trim();
}

function staffEvent(event: MockEvent): StaffEvent {
  const name = ownerName(event);
  return {
    id: event.id,
    name: event.name,
    start_date: isoDate(event.startOffset),
    end_date: isoDate(event.endOffset),
    start_time: event.startTime,
    end_time: event.endTime,
    in_draft: event.inDraft,
    income: event.income,
    platform_fee: Math.round(event.income * (event.currency === 'RON' ? 0 : 0.05) * 100) / 100,
    payment_done: paymentDone[event.id] ?? false,
    country: event.country,
    region: event.region,
    currency: event.currency,
    coupons: COUPONS[event.id] ?? [],
    owner_name: name,
    owner_id: event.ownerId,
    owner_slug: name.toLowerCase().replace(/ /g, '_'),
  };
}

function scopedEvents(scope: 'ro' | 'md'): MockEvent[] {
  return mockEvents.filter((event) => {
    const inScope =
      scope === 'ro'
        ? event.currency === 'RON' || event.country.toLowerCase() === 'romania'
        : event.currency === 'MDL' || event.country.toLowerCase() === 'moldova';
    return inScope && event.ticketsSold > 0;
  });
}

function matchesSearch(event: StaffEvent, search: string): boolean {
  if (!search) return true;
  if (/^\d+$/.test(search) && event.id === Number(search)) return true;
  const haystack = `${event.name} ${event.owner_name}`.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function staffList(scope: 'ro' | 'md') {
  return (request: MockRequest) => {
    if (!currentMockUser(request).is_staff) return mockError(403, { error: 'You are not a staff member' });
    const body = bodyOf<{ page: number; page_size: number; search: string; country: string; region: string; payment: string }>(
      request,
    );
    const scoped = scopedEvents(scope).map(staffEvent);
    const search = (body.search ?? '').trim();
    const country = (body.country ?? 'all').toLowerCase();
    const region = (body.region ?? 'all').toLowerCase();
    const payment = (body.payment ?? 'all').toLowerCase();
    const filtered = scoped
      .filter((event) => matchesSearch(event, search))
      .filter((event) => country === 'all' || (event.country ?? '').toLowerCase() === country)
      .filter((event) => region === 'all' || (event.region ?? '').toLowerCase() === region)
      .filter((event) => payment === 'all' || event.payment_done === (payment === 'done'))
      .sort((a, b) => b.id - a.id);
    const pageSize = Math.max(1, Number(body.page_size) || PAGE_SIZE);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(1, Number(body.page) || 1), pages);
    const unique = (values: (string | null)[]) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
    return {
      events: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
      pages,
      filters: {
        countries: unique(scoped.map((event) => event.country)),
        regions: unique(scoped.map((event) => event.region)),
      },
    };
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

function seedTransfers(event: MockEvent, net: number, company: AccountingCompany | null): EventTransfer[] {
  const recipient = company?.name ?? '';
  const iban = company?.iban ?? '';
  if (event.id === 4105) {
    const first = 18000;
    return [
      {
        id: 7101,
        payment_number: 1,
        amount: first.toFixed(2),
        currency: event.currency,
        transfer_date: isoDate(event.endOffset + 6),
        recipient_name: recipient,
        recipient_iban: iban,
        reference: 'Decont 1/2',
        status: 'PAID',
        notes: '',
        created_at: isoDateTime(event.endOffset + 6, '10:12:00'),
        updated_at: isoDateTime(event.endOffset + 6, '10:12:00'),
      },
      {
        id: 7102,
        payment_number: 2,
        amount: round(net - first).toFixed(2),
        currency: event.currency,
        transfer_date: isoDate(event.endOffset + 15),
        recipient_name: recipient,
        recipient_iban: iban,
        reference: 'Decont 2/2',
        status: 'PAID',
        notes: '',
        created_at: isoDateTime(event.endOffset + 15, '11:40:00'),
        updated_at: isoDateTime(event.endOffset + 15, '11:40:00'),
      },
    ];
  }
  if (event.id === 4101) {
    return [
      {
        id: 7103,
        payment_number: 1,
        amount: '150000.00',
        currency: event.currency,
        transfer_date: isoDate(-3),
        recipient_name: recipient,
        recipient_iban: iban,
        reference: 'Avans vânzări online',
        status: 'PAID',
        notes: 'Avans aprobat de organizator.',
        created_at: isoDateTime(-3, '09:30:00'),
        updated_at: isoDateTime(-3, '09:30:00'),
      },
      {
        id: 7104,
        payment_number: 2,
        amount: '120000.00',
        currency: event.currency,
        transfer_date: isoDate(0),
        recipient_name: recipient,
        recipient_iban: iban,
        reference: 'Tranșa 2',
        status: 'PENDING',
        notes: '',
        created_at: isoDateTime(0, '08:05:00'),
        updated_at: isoDateTime(0, '08:05:00'),
      },
    ];
  }
  return [];
}

function recompute(accounting: EventAccounting): EventAccounting {
  const gross = Number(accounting.gross_total) || 0;
  const paid = accounting.transfers
    .filter((transfer) => transfer.status === 'PAID' && (transfer.currency || accounting.currency) === accounting.currency)
    .reduce((sum, transfer) => sum + (Number(transfer.amount) || 0), 0);
  const net = Number(accounting.net_to_organizer) || 0;
  return {
    ...accounting,
    vat_amount: accounting.has_vat ? round((gross * (Number(accounting.vat_percent) || 0)) / 100) : 0,
    tax_amount: accounting.has_tax ? round((gross * (Number(accounting.tax_percent) || 0)) / 100) : 0,
    paid_total: round(paid),
    remaining_amount: round(net - paid),
  };
}

function seedAccounting(event: MockEvent): EventAccounting {
  const company = COMPANIES[event.ownerId] ?? null;
  const commissionByOrganizer = event.currency === 'RON';
  const tickets = event.income;
  const feePercent = commissionByOrganizer ? 0 : 5;
  const fee = round((tickets * feePercent) / 100);
  const feeVatPercent = feePercent > 0 ? 20 : 0;
  const feeVat = round((fee * feeVatPercent) / (100 + feeVatPercent));
  const commissionPercent = commissionByOrganizer ? 5 : 0;
  const commission = round((tickets * commissionPercent) / 100);
  const net = round(tickets - commission);
  const refundedOrders = event.id === 4101 ? 3 : event.id === 4106 ? 86 : 0;
  const closed = event.id === 4105;
  return recompute({
    id: 5000 + event.id,
    event: event.id,
    event_title: event.name,
    event_currency: event.currency,
    event_country: event.country,
    event_start_date: isoDate(event.startOffset),
    event_end_date: isoDate(event.endOffset),
    owner_name: ownerName(event),
    has_vat: false,
    vat_percent: 0,
    has_tax: false,
    tax_percent: 0,
    gross_total: tickets,
    vat_amount: 0,
    tax_amount: 0,
    platform_fee: fee,
    net_to_organizer: net,
    currency: event.currency,
    payment_status: closed ? 'PAID' : event.id === 4101 ? 'PARTIAL' : 'PENDING',
    case_closed: closed,
    notes: closed ? 'Settled in two transfers. Decont sent to the organizer.' : '',
    recipient_name: closed ? (company?.name ?? '') : '',
    recipient_iban: closed ? (company?.iban ?? '') : '',
    recipient_company: company?.id ?? null,
    company,
    transfers: seedTransfers(event, net, company),
    paid_total: 0,
    remaining_amount: net,
    tickets_income: tickets,
    tickets_sold: event.ticketsSold,
    total_received: round(tickets - (event.id === 4102 ? 12600 : 0)),
    commission_paid_by: commissionByOrganizer ? 'ORGANIZER' : 'BUYER',
    commission_percent: commissionByOrganizer ? commissionPercent : feePercent,
    commission_amount: commission,
    buyer_fee_percent: feePercent,
    buyer_fee_vat_percent: feeVatPercent,
    buyer_fee_net: round(fee - feeVat),
    buyer_fee_vat: feeVat,
    buyer_fee_total: fee,
    tickets_total: tickets,
    collected_total: round(tickets + fee),
    eventino_income: round(fee + commission),
    refunded_buyer_fee_total: refundedOrders > 0 ? round(refundedOrders * (event.id === 4101 ? 22.5 : 5)) : 0,
    refunded_orders_count: refundedOrders,
    settlement_currency: null,
    settlement_gross: 0,
    settlement_base: 0,
    settlement_commission: 0,
    settlement_net: 0,
    settlement_paid: 0,
    settlement_remaining: 0,
    settlement_fx_rate: 0,
    settlement_orders_count: 0,
    unsettled_total: 0,
    unsettled_currency: null,
    unsettled_orders_count: 0,
  });
}

const accountings = new Map<number, EventAccounting>();
let nextTransferId = 7200;

function accountingFor(request: MockRequest): EventAccounting | MockError {
  if (!currentMockUser(request).is_staff) return mockError(403, { detail: 'You do not have permission to perform this action.' });
  const event = findMockEvent(request.params.id);
  if (!event) return mockError(404, { detail: 'Not found.' });
  const existing = accountings.get(event.id);
  if (existing) return existing;
  const seeded = seedAccounting(event);
  accountings.set(event.id, seeded);
  return seeded;
}

function save(accounting: EventAccounting): EventAccounting {
  const next = recompute(accounting);
  accountings.set(next.event, next);
  return next;
}

function transferFrom(body: Partial<TransferBody>, base: EventTransfer): EventTransfer {
  return {
    ...base,
    payment_number: body.payment_number ?? base.payment_number,
    amount: body.amount != null ? Number(body.amount).toFixed(2) : base.amount,
    currency: body.currency ?? base.currency,
    transfer_date: body.transfer_date !== undefined ? body.transfer_date : base.transfer_date,
    recipient_name: body.recipient_name ?? base.recipient_name,
    recipient_iban: body.recipient_iban ?? base.recipient_iban,
    reference: body.reference ?? base.reference,
    status: body.status ?? base.status,
    notes: body.notes ?? base.notes,
    updated_at: new Date().toISOString(),
  };
}

export const handlers: MockHandler[] = [
  mock('POST', '/api/v1/statistics/get_staff_ticket_data_ro/', staffList('ro')),
  mock('POST', '/api/v1/statistics/get_staff_ticket_data/', staffList('md')),
  mock('POST', '/api/v1/statistics/set-event-payment-status/', (request) => {
    if (!currentMockUser(request).is_staff) return mockError(403, { error: 'You are not a staff member' });
    const body = bodyOf<{ event_id: number; payment_done: boolean }>(request);
    const event = findMockEvent(body.event_id ?? 0);
    if (!event) return mockError(404, { error: 'Event not found' });
    if (typeof body.payment_done !== 'boolean') return mockError(400, { error: 'payment_done must be a boolean' });
    paymentDone[event.id] = body.payment_done;
    return { event_id: event.id, payment_done: body.payment_done };
  }),
  mock('GET', '/api/v1/event_accounting/event/:id/', accountingFor),
  mock('PATCH', '/api/v1/event_accounting/event/:id/', (request) => {
    const current = accountingFor(request);
    if (current instanceof MockError) return current;
    const patch = bodyOf<AccountingSettingsPatch>(request);
    return save({ ...current, ...patch });
  }),
  mock('GET', '/api/v1/event_transfers/event/:id/', (request) => {
    const current = accountingFor(request);
    return current instanceof MockError ? current : current.transfers;
  }),
  mock('POST', '/api/v1/event_transfers/event/:id/', (request) => {
    const current = accountingFor(request);
    if (current instanceof MockError) return current;
    const body = bodyOf<TransferBody>(request);
    if (!(Number(body.amount) > 0)) return mockError(400, { amount: ['A valid number is required.'] });
    const now = new Date().toISOString();
    const maxNumber = current.transfers.reduce((max, transfer) => Math.max(max, transfer.payment_number ?? 0), 0);
    nextTransferId += 1;
    const created = transferFrom(body, {
      id: nextTransferId,
      payment_number: maxNumber + 1,
      amount: '0.00',
      currency: current.currency,
      transfer_date: null,
      recipient_name: current.recipient_name || current.company?.name || '',
      recipient_iban: current.recipient_iban || current.company?.iban || '',
      reference: '',
      status: 'PENDING',
      notes: '',
      created_at: now,
      updated_at: now,
    });
    save({ ...current, transfers: [...current.transfers, created] });
    return created;
  }),
  mock('PATCH', '/api/v1/event_transfers/event/:id/:transferId/', (request) => {
    const current = accountingFor(request);
    if (current instanceof MockError) return current;
    const existing = current.transfers.find((transfer) => transfer.id === Number(request.params.transferId));
    if (!existing) return mockError(404, { detail: 'Not found.' });
    const updated = transferFrom(bodyOf<TransferBody>(request), existing);
    save({ ...current, transfers: current.transfers.map((transfer) => (transfer.id === existing.id ? updated : transfer)) });
    return updated;
  }),
  mock('DELETE', '/api/v1/event_transfers/event/:id/:transferId/', (request) => {
    const current = accountingFor(request);
    if (current instanceof MockError) return current;
    const transferId = Number(request.params.transferId);
    if (!current.transfers.some((transfer) => transfer.id === transferId)) return mockError(404, { detail: 'Not found.' });
    save({ ...current, transfers: current.transfers.filter((transfer) => transfer.id !== transferId) });
    return {};
  }),
];
