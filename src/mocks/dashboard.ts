import type { FacturaOrder } from '@/store/api/facturaApi';
import type {
  BuyerParticipantInfo,
  EventBuyer,
  FreeTicketRequest,
  OrganizerGraphPoint,
  OrganizerStatsBucket,
  PendingOrder,
  ReleaseManualTicketBody,
} from '@/store/api/organizerApi';

import { currentMockUser, eventsOf, findMockEvent, mockEvents, type MockEvent } from './core';
import { bodyOf, isoDate, isoDateTime, mock, mockError, type MockHandler, type MockRequest } from './mock';

const FIRST_NAMES = [
  'Ion',
  'Maria',
  'Elena',
  'Andrei',
  'Cristina',
  'Mihai',
  'Ana',
  'Vlad',
  'Daniela',
  'Alexandru',
  'Ioana',
  'Victor',
  'Natalia',
  'Sergiu',
  'Irina',
  'Radu',
  'Olga',
  'Dumitru',
  'Corina',
  'Adrian',
  'Larisa',
  'Bogdan',
  'Tatiana',
  'Cătălin',
];
const LAST_NAMES = [
  'Popescu',
  'Rusu',
  'Ceban',
  'Lungu',
  'Munteanu',
  'Ionescu',
  'Cojocaru',
  'Rotaru',
  'Moraru',
  'Dumitrescu',
  'Popa',
  'Bălan',
  'Croitoru',
  'Stan',
  'Ursu',
  'Vasilescu',
  'Grosu',
  'Toma',
];
const COMPANIES = ['Moldcell SA', 'Endava SRL', 'Orange Moldova SA', 'Bitdefender SRL', 'Maib SA', 'Vinăria Purcari SRL'];
const ANSWERS: [string, string][] = [
  ['Instagram', 'Nu'],
  ['Facebook', 'Vegetarian'],
  ['De la prieteni', 'Fără gluten'],
  ['TikTok', 'No answer'],
];
const COUPONS: (string | null)[] = [null, null, null, 'TOAMNA20', null, 'STUDENT15'];
const BUYER_COUNTS: Record<number, number> = {
  4101: 46,
  4102: 30,
  4103: 18,
  4105: 22,
  4106: 12,
  4201: 9,
  4301: 9,
};
const PENDING_COUNTS: Record<number, number> = {
  4101: 6,
  4102: 3,
  4103: 4,
  4105: 1,
};
const HOUR_WEIGHTS = [
  0.5, 0.3, 0.2, 0.1, 0.1, 0.1, 0.3, 0.6, 1, 1.4, 1.6, 1.8, 2, 1.9, 1.7, 1.6, 1.8, 2.2, 2.6, 2.8, 2.6, 2.1, 1.5, 0.9,
];
const HOUR_TOTAL = HOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

interface MockFacturaOrder extends FacturaOrder {
  event: number;
  source: 'bank' | 'online';
  customer_type: 'juridice' | 'fizice';
}

interface BuyersBody {
  event_id?: number;
  time_interval?: string;
  page?: number;
  page_size?: number;
  search?: string;
  is_scanned?: boolean;
}

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function personAt(seed: number) {
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const last = LAST_NAMES[(seed * 5 + 3) % LAST_NAMES.length];
  return {
    first_name: first,
    last_name: last,
    email: `${plain(first)}.${plain(last)}${seed % 7 === 0 ? seed % 100 : ''}@gmail.com`,
  };
}

function phoneFor(event: MockEvent, seed: number): string {
  const digits = String(1000000 + ((seed * 7919) % 8999999));
  return event.country === 'Romania' ? `+407${digits.slice(0, 8).padEnd(8, '4')}` : `+3736${digits.slice(0, 7)}`;
}

function paymentMethodFor(event: MockEvent, index: number): string {
  if (index % 9 === 4) return 'INVOICE';
  if (event.currency !== 'MDL') return index % 4 === 1 ? 'STRIPE' : 'NETOPIA';
  return index % 5 === 2 ? 'MAIB_MIA_QR' : 'MAIB';
}

function buildBuyers(event: MockEvent): EventBuyer[] {
  const count = BUYER_COUNTS[event.id] ?? 0;
  const started = event.startOffset < 0;
  const lastSaleDay = Math.min(0, event.startOffset);
  return Array.from({ length: count }, (_, index) => {
    const seed = index * 7 + event.id;
    const person = personAt(seed);
    const isFollower = index % 15 === 14;
    const ticketType = event.ticketTypes[index % event.ticketTypes.length];
    const ticketCount = isFollower ? 0 : index % 4 === 0 ? 3 : index % 3 === 0 ? 2 : 1;
    const scanned =
      started && !isFollower ? (index % 5 === 3 ? 0 : index % 7 === 2 ? Math.max(1, ticketCount - 1) : ticketCount) : 0;
    const coupon = isFollower ? null : COUPONS[index % COUPONS.length];
    const discount = coupon === 'TOAMNA20' ? 0.8 : coupon === 'STUDENT15' ? 0.85 : 1;
    const [source, diet] = ANSWERS[index % ANSWERS.length];
    const participants: BuyerParticipantInfo[] =
      ticketCount > 1
        ? Array.from({ length: ticketCount }, (_, slot) => {
            const guest = slot === 0 ? person : personAt(seed + slot * 11);
            return { ...guest, phone: phoneFor(event, seed + slot) };
          })
        : [];
    const attendance =
      isFollower || !started ? null : scanned === 0 ? 'No-show' : scanned < ticketCount ? 'Partial attendance' : 'Attended';
    return {
      id: event.id * 1000 + index + 1,
      order_id: isFollower ? null : event.id * 100 + index + 1,
      ...person,
      name: `${person.first_name} ${person.last_name}`,
      profile_image: null,
      ticket_name: isFollower ? null : ticketType.name,
      ticket_count: ticketCount,
      currency: event.currency,
      total_price: isFollower ? 0 : Math.round(ticketType.price * ticketCount * discount * 100) / 100,
      date: isoDateTime(
        lastSaleDay - ((index * 7) % 40),
        `${String(9 + (index % 13)).padStart(2, '0')}:${String((index * 17) % 60).padStart(2, '0')}:00`,
      ),
      payment_method: isFollower ? null : paymentMethodFor(event, index),
      user_type: isFollower ? 'follower' : 'buyer',
      attendance_status: attendance,
      scanned_count: scanned,
      coupon_code: coupon,
      questions_and_answers: isFollower
        ? []
        : [
            { question: 'Cum ați aflat de eveniment?', answer: source },
            { question: 'Aveți restricții alimentare?', answer: diet },
          ],
      participants_info: participants,
    };
  });
}

function buildPending(event: MockEvent): PendingOrder[] {
  const count = PENDING_COUNTS[event.id] ?? 0;
  return Array.from({ length: count }, (_, index) => {
    const person = personAt(index * 13 + event.id + 5);
    const ticketType = event.ticketTypes[(index + 1) % event.ticketTypes.length];
    const quantity = 1 + (index % 3);
    return {
      id: event.id * 10 + index,
      user: person,
      order_date: isoDateTime(-(index % 4), `${String(10 + index).padStart(2, '0')}:15:00`),
      total_price: (ticketType.price * quantity).toFixed(2),
      payment_method: index % 2 === 0 ? 'INVOICE' : event.currency === 'MDL' ? 'MAIB' : 'NETOPIA',
      tickets: Array.from({ length: quantity }, () => ({
        ticket_type_name: ticketType.name,
        price: ticketType.price.toFixed(2),
      })),
    };
  });
}

let invoiceSerial = 148;

function nextSerial(): {
  invoice_serial: string;
  invoice_serial_number: number;
  invoice_serial_prefix: string;
} {
  invoiceSerial += 1;
  return {
    invoice_serial: `EVN-${String(invoiceSerial).padStart(4, '0')}`,
    invoice_serial_number: invoiceSerial,
    invoice_serial_prefix: 'EVN',
  };
}

function buildFactura(event: MockEvent): MockFacturaOrder[] {
  if (event.inDraft || event.ticketsSold === 0) return [];
  const plan: {
    source: 'bank' | 'online';
    type: 'juridice' | 'fizice';
    daysAgo: number;
    downloaded: boolean;
  }[] = [
    { source: 'bank', type: 'juridice', daysAgo: 1, downloaded: false },
    { source: 'bank', type: 'juridice', daysAgo: 4, downloaded: false },
    { source: 'bank', type: 'juridice', daysAgo: 9, downloaded: true },
    { source: 'bank', type: 'fizice', daysAgo: 7, downloaded: false },
    { source: 'online', type: 'juridice', daysAgo: 0, downloaded: false },
    { source: 'online', type: 'juridice', daysAgo: 3, downloaded: false },
    { source: 'online', type: 'juridice', daysAgo: 6, downloaded: false },
    { source: 'online', type: 'fizice', daysAgo: 2, downloaded: false },
    { source: 'online', type: 'fizice', daysAgo: 5, downloaded: false },
    { source: 'online', type: 'fizice', daysAgo: 11, downloaded: true },
  ];
  return plan.map((entry, index) => {
    const person = personAt(index * 3 + event.id + 1);
    const ticketType = event.ticketTypes[index % event.ticketTypes.length];
    const quantity = entry.type === 'juridice' ? 4 + (index % 3) * 3 : 1 + (index % 2);
    return {
      id: event.id * 10 + 500 + index,
      event: event.id,
      source: entry.source,
      customer_type: entry.type,
      user: {
        ...person,
        company_name: entry.type === 'juridice' ? COMPANIES[index % COMPANIES.length] : null,
      },
      order_date: isoDateTime(-entry.daysAgo, `${String(9 + index).padStart(2, '0')}:40:00`),
      total_price: (ticketType.price * quantity).toFixed(2),
      payment_method: entry.source === 'bank' ? 'INVOICE' : event.currency === 'MDL' ? 'MAIB' : 'NETOPIA',
      payment_status: 'PAID',
      factura_sent: true,
      factura_downloaded: entry.downloaded,
      factura_downloaded_at: entry.downloaded ? isoDateTime(-entry.daysAgo + 1, '16:00:00') : null,
      tickets: Array.from({ length: quantity }, () => ({
        ticket_type_name: ticketType.name,
        price: ticketType.price.toFixed(2),
      })),
      ...nextSerial(),
    };
  });
}

function buildFreeRequests(event: MockEvent): FreeTicketRequest[] {
  if (!event.freeTicketApproval) return [];
  const coupons = ['PRESA100', 'VOLUNTAR100', 'PARTENER100', 'PRESA100'];
  return coupons.map((coupon, index) => {
    const person = personAt(index * 19 + event.id + 2);
    const ticketType = event.ticketTypes[index % 2];
    const count = index === 1 ? 2 : 1;
    const id = event.id * 10 + 900 + index;
    return {
      id,
      order_id: id,
      ...person,
      name: `${person.first_name} ${person.last_name}`,
      submission_date: isoDateTime(-index, `${String(11 + index * 2).padStart(2, '0')}:05:00`),
      coupon_code: coupon,
      tickets: Array.from({ length: count }, () => ticketType.name),
      ticket_name: ticketType.name,
      ticket_count: count,
    };
  });
}

function lazyStore<T>(build: (event: MockEvent) => T[]) {
  const store = new Map<number, T[]>();
  return (eventId: number): T[] => {
    let list = store.get(eventId);
    if (!list) {
      const event = findMockEvent(eventId);
      list = event ? build(event) : [];
      store.set(eventId, list);
    }
    return list;
  };
}

const buyersOf = lazyStore(buildBuyers);
const pendingOf = lazyStore(buildPending);
const facturaOf = lazyStore(buildFactura);
const freeRequestsOf = lazyStore(buildFreeRequests);

function newBuyer(
  eventId: number,
  input: {
    first_name: string;
    last_name: string;
    email: string;
    ticketName: string;
    count: number;
    price: number;
    method: string | null;
    coupon?: string | null;
    phone?: string;
  },
): EventBuyer {
  const event = findMockEvent(eventId);
  const list = buyersOf(eventId);
  const id = eventId * 1000 + 900 + list.length;
  return {
    id,
    order_id: id,
    first_name: input.first_name,
    last_name: input.last_name,
    name: `${input.first_name} ${input.last_name}`.trim(),
    email: input.email,
    profile_image: null,
    ticket_name: input.ticketName,
    ticket_count: input.count,
    currency: event?.currency ?? 'MDL',
    total_price: input.price,
    date: new Date().toISOString(),
    payment_method: input.method,
    user_type: 'buyer',
    attendance_status: event && event.startOffset < 0 ? 'No-show' : null,
    scanned_count: 0,
    coupon_code: input.coupon ?? null,
    questions_and_answers: [],
    participants_info: input.phone
      ? [
          {
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            phone: input.phone,
          },
        ]
      : [],
  };
}

function weekShare(event: MockEvent, weeksAgo: 0 | 1): number {
  if (event.inDraft) return 0;
  const lastSaleDay = Math.min(0, event.startOffset);
  if (lastSaleDay < -7 * weeksAgo - 6) return 0;
  return weeksAgo === 0 ? 0.12 : 0.09;
}

function addTo(map: Record<string, number>, code: string, amount: number) {
  map[code] = (map[code] ?? 0) + amount;
}

function statsBucket(events: MockEvent[], shareOf: (event: MockEvent) => number): OrganizerStatsBucket {
  const income: Record<string, number> = {};
  const invoice: Record<string, number> = {};
  const received: Record<string, number> = {};
  let sold = 0;
  let users = 0;
  let favorites = 0;
  let manual = 0;
  let scanned = 0;
  for (const event of events) {
    const share = shareOf(event);
    const eventIncome = Math.round(event.income * share);
    const eventInvoice = Math.round(eventIncome * 0.06);
    addTo(income, event.currency, eventIncome);
    addTo(invoice, event.currency, eventInvoice);
    addTo(received, event.currency, eventIncome - eventInvoice);
    sold += Math.round(event.ticketsSold * share);
    users += Math.round(event.participants * share);
    favorites += Math.round(event.ticketsSold * 0.18 * share);
    manual += Math.round(event.ticketsSold * 0.04 * share);
    scanned += Math.round(event.ticketsScanned * share);
  }
  const total = (map: Record<string, number>) => Object.values(map).reduce((sum, value) => sum + value, 0);
  const totalTickets = sold + manual;
  const manualScanned = Math.min(manual, Math.round(manual * (scanned / Math.max(1, totalTickets))));
  const currency = events[0]?.currency ?? 'MDL';
  return {
    new_users: users,
    income: total(income),
    income_by_currency: income,
    tickets_sold: sold,
    favorited_by: favorites,
    total_tickets: totalTickets,
    scanned_tickets: scanned,
    not_scanned_tickets: Math.max(0, totalTickets - scanned),
    manual_tickets_count: manual,
    manual_scanned_tickets: manualScanned,
    not_manual_scanned_tickets: manual - manualScanned,
    invoice_income_total: total(invoice),
    invoice_income_by_currency: invoice,
    total_received: total(received),
    total_received_by_currency: received,
    event_currency: currency,
    income_currency: currency,
  };
}

function statsEvents(request: MockRequest): MockEvent[] {
  const eventId = bodyOf<{ event_id: number }>(request).event_id;
  if (eventId != null) {
    const event = findMockEvent(eventId);
    return event ? [event] : [];
  }
  return eventsOf(currentMockUser(request));
}

function salesDays(event: MockEvent): { offset: number; weight: number }[] {
  if (event.inDraft || event.ticketsSold === 0) return [];
  const last = Math.min(0, event.endOffset);
  const first = event.startOffset - 75;
  const days: { offset: number; weight: number }[] = [];
  for (let offset = first; offset <= last; offset += 1) {
    const toStart = event.startOffset - offset;
    const ramp = toStart <= 3 ? 3.2 : toStart <= 10 ? 1.8 : 1;
    const wave = 1 + 0.55 * Math.sin((offset + event.id) * 0.9) ** 2;
    const launch = offset - first < 3 ? 2.4 : 1;
    days.push({ offset, weight: ramp * wave * launch });
  }
  return days;
}

function addPoint(points: Map<string, OrganizerGraphPoint>, key: string, event: MockEvent, share: number) {
  const point = points.get(key) ?? {
    date: key,
    new_users: 0,
    income: 0,
    income_by_currency: {},
    tickets_sold: 0,
    favorited_by: 0,
  };
  const income = Math.round(event.income * share);
  point.income += income;
  point.income_by_currency[event.currency] = (point.income_by_currency[event.currency] ?? 0) + income;
  point.tickets_sold += Math.round(event.ticketsSold * share);
  point.new_users += Math.round(event.participants * share);
  point.favorited_by += Math.round(event.ticketsSold * 0.18 * share);
  points.set(key, point);
}

function graphPoints(events: MockEvent[], hourDate?: string): OrganizerGraphPoint[] {
  const points = new Map<string, OrganizerGraphPoint>();
  for (const event of events) {
    const days = salesDays(event);
    const total = days.reduce((sum, day) => sum + day.weight, 0);
    for (const day of days) {
      const share = day.weight / total;
      const date = isoDate(day.offset);
      if (!hourDate) {
        addPoint(points, date, event, share);
        continue;
      }
      if (date !== hourDate) continue;
      HOUR_WEIGHTS.forEach((weight, hour) =>
        addPoint(points, `${date}T${String(hour).padStart(2, '0')}:00:00`, event, (share * weight) / HOUR_TOTAL),
      );
    }
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function matchesBuyerSearch(buyer: EventBuyer, search: string): boolean {
  const query = plain(search.replace(/[,;#]/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!query) return true;
  const people = (buyer.participants_info ?? []).flatMap((info) => Object.values(info));
  const values = [buyer.name, buyer.email, buyer.display_name, buyer.order_id, buyer.coupon_code, buyer.ticket_name, ...people];
  if (/^[\d\s+()-]+$/.test(query)) {
    const digits = query.replace(/\D/g, '');
    return values.some((value) =>
      String(value ?? '')
        .replace(/\D/g, '')
        .includes(digits),
    );
  }
  const haystack = plain(values.filter((value) => value != null).join(' '));
  return query.split(' ').every((token) => haystack.includes(token));
}

function findOrderList<T extends { id?: number; order_id?: number | null }>(
  lists: (eventId: number) => T[],
  orderId: number,
): { eventId: number; list: T[]; index: number } | null {
  for (const event of mockEvents) {
    const list = lists(event.id);
    const index = list.findIndex((item) => (item.id ?? item.order_id) === orderId || item.order_id === orderId);
    if (index >= 0) return { eventId: event.id, list, index };
  }
  return null;
}

export const handlers: MockHandler[] = [
  mock('POST', '/api/v1/statistics/get-recent-stats/', (request) => {
    const events = statsEvents(request);
    const currencies = [...new Set([...events].sort((a, b) => b.income - a.income).map((event) => event.currency))];
    return {
      all_time: statsBucket(events, () => 1),
      this_week: statsBucket(events, (event) => weekShare(event, 0)),
      previous_week: statsBucket(events, (event) => weekShare(event, 1)),
      event_currencies: currencies,
    };
  }),
  mock('POST', '/api/v1/statistics/get-stats-graph/', (request) => {
    const body = bodyOf<{ time_interval: string; target_date: string }>(request);
    const events = statsEvents(request);
    return graphPoints(events, body.time_interval === 'hour' ? body.target_date : undefined);
  }),
  mock('POST', '/api/v1/statistics/get-buyers-list/', (request) => {
    const body = bodyOf<BuyersBody>(request);
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = Math.max(1, Number(body.page_size) || 20);
    const since =
      body.time_interval === 'day'
        ? isoDate(0)
        : body.time_interval === 'week'
          ? isoDate(-7)
          : body.time_interval === 'month'
            ? isoDate(-30)
            : null;
    const rows = buyersOf(Number(body.event_id))
      .filter((buyer) => !since || (buyer.date ?? '') >= since)
      .filter((buyer) => matchesBuyerSearch(buyer, body.search ?? ''))
      .filter((buyer) => {
        if (body.is_scanned === true) return buyer.user_type === 'buyer' && (buyer.scanned_count ?? 0) > 0;
        if (body.is_scanned === false)
          return buyer.user_type === 'buyer' && (buyer.ticket_count ?? 0) > 0 && (buyer.scanned_count ?? 0) === 0;
        return true;
      });
    const start = (page - 1) * pageSize;
    return {
      results: rows.slice(start, start + pageSize),
      total_count: rows.length,
      has_next: start + pageSize < rows.length,
      has_previous: page > 1,
      page,
      page_size: pageSize,
    };
  }),
  mock('GET', '/api/v1/tickets/pending-orders/', ({ query }) => [...pendingOf(Number(query.event_id))]),
  mock('POST', '/api/v1/tickets/mark-invoice-as-paid/', (request) => {
    const orderId = Number(bodyOf<{ order_id: number }>(request).order_id);
    const found = findOrderList(pendingOf, orderId);
    if (!found) return mockError(404, { error: 'Order not found' });
    const [order] = found.list.splice(found.index, 1);
    const person = order.user;
    const tickets = order.tickets ?? [];
    facturaOf(found.eventId).unshift({
      ...order,
      event: found.eventId,
      source: 'bank',
      customer_type: 'juridice',
      payment_status: 'PAID',
      factura_sent: true,
      factura_downloaded: false,
      ...nextSerial(),
    });
    buyersOf(found.eventId).unshift(
      newBuyer(found.eventId, {
        first_name: person?.first_name ?? '',
        last_name: person?.last_name ?? '',
        email: person?.email ?? '',
        ticketName: tickets[0]?.ticket_type_name ?? '',
        count: tickets.length,
        price: Number(order.total_price ?? 0),
        method: 'INVOICE',
      }),
    );
    return { message: 'Order marked as paid', factura_sent: true };
  }),
  mock('GET', '/api/v1/tickets/factura-orders/', ({ query }) =>
    facturaOf(Number(query.event_id)).filter(
      (order) =>
        order.source === 'bank' &&
        (!query.customer_type || query.customer_type === 'all' || order.customer_type === query.customer_type),
    ),
  ),
  mock('GET', '/api/v1/tickets/factura-individual-orders/', ({ query }) =>
    facturaOf(Number(query.event_id)).filter(
      (order) =>
        order.source === 'online' &&
        (!query.customer_type || query.customer_type === 'all' || order.customer_type === query.customer_type),
    ),
  ),
  mock('POST', '/api/v1/tickets/edit-invoice-serial/', (request) => {
    const body = bodyOf<{ order_id: number; invoice_serial_number: number }>(request);
    const found = findOrderList(facturaOf, Number(body.order_id));
    if (!found) return mockError(404, { error: 'Order not found' });
    const order = found.list[found.index];
    order.invoice_serial_number = Number(body.invoice_serial_number);
    order.invoice_serial = `${order.invoice_serial_prefix ?? 'EVN'}-${String(order.invoice_serial_number).padStart(4, '0')}`;
    return { id: order.id, invoice_serial: order.invoice_serial, invoice_serial_number: order.invoice_serial_number };
  }),
  mock('GET', '/api/v1/tickets/free-ticket-requests/', ({ query }) => [...freeRequestsOf(Number(query.event_id))]),
  mock('POST', '/api/v1/tickets/send-free-ticket/', (request) => {
    const orderId = Number(bodyOf<{ order_id: number }>(request).order_id);
    const found = findOrderList(freeRequestsOf, orderId);
    if (!found) return mockError(404, { error: 'Request not found' });
    const [sent] = found.list.splice(found.index, 1);
    buyersOf(found.eventId).unshift(
      newBuyer(found.eventId, {
        first_name: sent.first_name ?? '',
        last_name: sent.last_name ?? '',
        email: sent.email ?? '',
        ticketName: sent.ticket_name ?? '',
        count: sent.ticket_count ?? 1,
        price: 0,
        method: null,
        coupon: sent.coupon_code,
      }),
    );
    return { message: 'Ticket sent' };
  }),
  mock('POST', '/api/v1/tickets/reject-free-ticket/', (request) => {
    const orderId = Number(bodyOf<{ order_id: number }>(request).order_id);
    const found = findOrderList(freeRequestsOf, orderId);
    if (!found) return mockError(404, { error: 'Request not found' });
    found.list.splice(found.index, 1);
    return { message: 'Request rejected' };
  }),
  mock('POST', '/api/v1/tickets/:eventId/release-manual-ticket/', (request) => {
    const event = findMockEvent(request.params.eventId);
    if (!event) return mockError(404, { error: 'Event not found' });
    const body = bodyOf<Omit<ReleaseManualTicketBody, 'eventId'>>(request);
    const ticketType = event.ticketTypes.find((type) => type.id === Number(body.ticketTypeId));
    if (!ticketType) return mockError(400, { error: 'Invalid ticket type' });
    buyersOf(event.id).unshift(
      newBuyer(event.id, {
        first_name: body.firstName ?? '',
        last_name: body.lastName ?? '',
        email: body.email ?? '',
        ticketName: ticketType.name,
        count: Number(body.quantity) || 1,
        price: 0,
        method: null,
        phone: body.phone,
      }),
    );
    return { message: 'Ticket released successfully' };
  }),
  mock('POST', '/api/v1/events/:id/cancel-event/', (request) => {
    const event = findMockEvent(request.params.id);
    if (!event) return mockError(404, { detail: 'Not found.' });
    event.isCancelled = true;
    event.cancellationReason = bodyOf<{ reason: string }>(request).reason ?? '';
    return { detail: 'Event cancelled' };
  }),
];
