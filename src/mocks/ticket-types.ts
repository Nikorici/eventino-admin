import type { EventTicketRecord } from '@/store/api/organizerApi';
import type { CreateTicketTypeParams, ManageTicketType } from '@/store/api/ticketTypesApi';

import { findMockEvent, mockEvents, type MockEvent } from './core';
import { bodyOf, isoDate, isoDateTime, mock, mockError, type MockHandler } from './mock';

const SCAN_COLOR_PALETTE = [
  '#1E88E5',
  '#FB8C00',
  '#8E24AA',
  '#FDD835',
  '#00ACC1',
  '#D81B60',
  '#6D4C41',
  '#3949AB',
  '#C0CA33',
  '#546E7A',
  '#E53935',
  '#43A047',
];

type StoredTicketType = Omit<ManageTicketType, 'remaining' | 'effective_scan_color'>;

let nextTicketTypeId = 7200;

function baseTicketType(event: MockEvent, id: number, overrides: Partial<StoredTicketType>): StoredTicketType {
  return {
    id,
    event: event.id,
    name: '',
    price: '0.00',
    quantity: null,
    category: 'ticket',
    comment: '',
    qr_code_quantity: 1,
    display_order: 0,
    is_table: false,
    show_remaining_tickets: false,
    is_active: !event.isCancelled,
    is_sold_out: false,
    sold_out_reason: null,
    sold_count: 0,
    event_day: null,
    quantity_discounts: null,
    sale_start_date: null,
    sale_end_date: null,
    is_online: false,
    stream_url: '',
    scan_color: null,
    ...overrides,
  };
}

const extrasByEvent: Record<number, Partial<StoredTicketType>[]> = {
  4101: [
    {
      id: 7101,
      name: 'Transmisiune live',
      price: '80.00',
      quantity: null,
      sold_count: 46,
      is_online: true,
      stream_url: 'https://vimeo.com/event/4101421',
    },
    {
      id: 7102,
      name: 'Masterclass sommelier',
      price: '400.00',
      quantity: 40,
      sold_count: 28,
      event_day: isoDate(0),
      scan_color: '#43A047',
    },
    { id: 7103, name: 'Early Bird', price: '120.00', quantity: 300, sold_count: 300, is_active: false },
  ],
};

const coreOverrides: Record<number, Partial<StoredTicketType>> = {
  51: {
    quantity_discounts: [
      { min_quantity: 3, percent: 5 },
      { min_quantity: 5, percent: 10 },
    ],
  },
};

let ticketTypes: StoredTicketType[] = mockEvents.flatMap((event) => [
  ...event.ticketTypes.map((ticketType, index) =>
    baseTicketType(event, ticketType.id, {
      name: ticketType.name,
      price: ticketType.price.toFixed(2),
      quantity: ticketType.quantity,
      sold_count: ticketType.sold,
      display_order: index,
      ...coreOverrides[ticketType.id],
    }),
  ),
  ...(extrasByEvent[event.id] ?? []).map((extra, index) =>
    baseTicketType(event, extra.id ?? 0, { display_order: event.ticketTypes.length + index, ...extra }),
  ),
]);

function present(ticketType: StoredTicketType): ManageTicketType {
  const position = ticketTypes.filter((item) => item.event === ticketType.event && item.id < ticketType.id).length;
  return {
    ...ticketType,
    quantity_discounts: ticketType.quantity_discounts?.map((tier) => ({ ...tier })) ?? null,
    remaining: ticketType.quantity == null ? null : Math.max(0, ticketType.quantity - ticketType.sold_count),
    effective_scan_color: ticketType.scan_color || SCAN_COLOR_PALETTE[position % SCAN_COLOR_PALETTE.length],
  };
}

const ATTENDEES = [
  'Ana Popescu',
  'Ion Rusu',
  'Maria Ciobanu',
  'Andrei Lungu',
  'Elena Cojocaru',
  'Victor Munteanu',
  'Cristina Botnaru',
  'Mihai Țurcanu',
  'Irina Ceban',
  'Dan Moraru',
];

let nextTicketId = 20417;

const ticketsByEvent: Record<number, EventTicketRecord[]> = Object.fromEntries(
  mockEvents.map((event) => [
    event.id,
    ticketTypes
      .filter((ticketType) => ticketType.event === event.id && ticketType.sold_count > 0)
      .flatMap((ticketType, typeIndex) =>
        Array.from({ length: Math.min(3, ticketType.sold_count) }, (_, index): EventTicketRecord => {
          const seed = typeIndex * 3 + index;
          const account = ATTENDEES[seed % ATTENDEES.length];
          nextTicketId += 1;
          return {
            id: nextTicketId,
            uuid: `5f1c${event.id}-0000-4e7a-9b21-${String(nextTicketId).padStart(12, '0')}`,
            ticket_type: ticketType.name,
            account_name: account,
            display_name: seed % 3 === 2 ? '' : account,
            scan_date: event.startOffset <= 0 && seed % 2 === 0 ? isoDateTime(event.startOffset, '18:42:00') : null,
            order_id: 88000 + event.id + Math.floor(seed / 2),
          };
        }),
      ),
  ]),
);

function findTicketType(id: string): StoredTicketType | undefined {
  return ticketTypes.find((item) => item.id === Number(id));
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/ticket-types/by-event/', ({ query }) => {
    const eventId = Number(query.event_id);
    if (!findMockEvent(eventId)) return mockError(404, { detail: 'Event not found' });
    return ticketTypes
      .filter((item) => item.event === eventId)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.id - b.id)
      .map(present);
  }),
  mock('POST', '/api/v1/ticket-types/', (request) => {
    const body = bodyOf<CreateTicketTypeParams>(request);
    const event = findMockEvent(Number(body.event));
    if (!event) return mockError(404, { detail: 'Event not found' });
    if (!body.name?.trim()) return mockError(400, { name: ['This field may not be blank.'] });
    nextTicketTypeId += 1;
    const created = baseTicketType(event, nextTicketTypeId, {
      name: body.name.trim(),
      price: Number(body.price ?? 0).toFixed(2),
      quantity: body.quantity ?? null,
      event_day: body.event_day ?? null,
      quantity_discounts: body.quantity_discounts ?? null,
      is_online: body.is_online ?? false,
      stream_url: body.stream_url ?? '',
      scan_color: body.scan_color ?? null,
      display_order: ticketTypes.filter((item) => item.event === event.id).length,
    });
    ticketTypes = [...ticketTypes, created];
    return present(created);
  }),
  mock('GET', '/api/v1/ticket-types/:id/', ({ params }) => {
    const ticketType = findTicketType(params.id);
    return ticketType ? present(ticketType) : mockError(404, { detail: 'Not found.' });
  }),
  mock('PATCH', '/api/v1/ticket-types/:id/', (request) => {
    const ticketType = findTicketType(request.params.id);
    if (!ticketType) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<CreateTicketTypeParams>(request);
    if (body.quantity != null && body.quantity < ticketType.sold_count) {
      return mockError(400, {
        quantity: [`Quantity cannot be lower than tickets already sold (${ticketType.sold_count}).`],
      });
    }
    if (body.price != null && ticketType.sold_count > 0 && Number(body.price) !== Number(ticketType.price)) {
      return mockError(400, {
        price: ['Price cannot change after tickets were sold. Hide this ticket and create a new one.'],
      });
    }
    const updated: StoredTicketType = {
      ...ticketType,
      ...body,
      ...(body.price != null ? { price: Number(body.price).toFixed(2) } : {}),
    };
    ticketTypes = ticketTypes.map((item) => (item.id === updated.id ? updated : item));
    return present(updated);
  }),
  mock('DELETE', '/api/v1/ticket-types/:id/', ({ params }) => {
    const ticketType = findTicketType(params.id);
    if (!ticketType) return mockError(404, { detail: 'Not found.' });
    if (ticketType.sold_count > 0) {
      return mockError(400, { detail: 'Cannot delete a ticket type that has sold tickets. Deactivate it instead.' });
    }
    ticketTypes = ticketTypes.filter((item) => item.id !== ticketType.id);
    return {};
  }),
  mock('GET', '/api/v1/tickets/event-tickets/', ({ query }) => {
    const eventId = Number(query.event_id);
    if (!findMockEvent(eventId)) return mockError(404, { message: 'Event not found' });
    return (ticketsByEvent[eventId] ?? []).map((ticket) => ({ ...ticket }));
  }),
  mock('PATCH', '/api/v1/tickets/:id/set-display-name/', (request) => {
    const ticketId = Number(request.params.id);
    const eventId = Object.keys(ticketsByEvent).find((key) =>
      ticketsByEvent[Number(key)].some((item) => item.id === ticketId),
    );
    if (eventId == null) return mockError(404, { message: 'Ticket not found', code: 'not_found' });
    const displayName = bodyOf<{ display_name: string }>(request).display_name ?? '';
    ticketsByEvent[Number(eventId)] = ticketsByEvent[Number(eventId)].map((item) =>
      item.id === ticketId ? { ...item, display_name: displayName } : item,
    );
    return { id: ticketId, display_name: displayName };
  }),
];
