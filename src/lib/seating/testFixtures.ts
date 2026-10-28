import type {
  EventSeatMapResponse,
  HoldSeat,
  LayoutSection,
  PricedHoldSeat,
  SeatHoldPayload,
  VenueLayoutDetail,
} from '@/types/seating';

function section(id: number, key: string, name: string, outline: [number, number][], rows: LayoutSection['rows']): LayoutSection {
  return {
    id,
    key,
    name,
    name_i18n: null,
    color: '#6fb2e0',
    display_order: id,
    label: null,
    outline,
    row_labels: { mode: 'ends', x: null },
    rows,
  };
}

function seat(id: number, label: string, x: number, y: number) {
  return { id, label, x, y, is_accessible: false, is_default_blocked: false };
}

export const fixtureLayout: VenueLayoutDetail = {
  id: 1,
  name: 'Sala Mare',
  slug: 'sala-mare',
  status: 'active',
  venue: { id: 1, name: 'Palatul', location: 'Chisinau' },
  canvas: { width: 800, height: 800 },
  seat_radius: 13,
  elements: [],
  sections: [
    section(
      1,
      'parter',
      'Parter',
      [
        [0, 0],
        [400, 0],
        [400, 200],
        [0, 200],
      ],
      [
        { id: 10, label: '1', display_order: 1, seats: [seat(101, '1', 50, 50), seat(102, '2', 90, 50), seat(103, '3', 130, 50)] },
        { id: 11, label: '2', display_order: 2, seats: [seat(104, '1', 50, 90), seat(105, '2', 90, 90)] },
      ],
    ),
    section(
      2,
      'balcon',
      'Balcon',
      [
        [100, 50],
        [300, 50],
        [300, 150],
        [100, 150],
      ],
      [{ id: 20, label: '1', display_order: 1, seats: [seat(201, '1', 200, 100)] }],
    ),
    section(
      3,
      'loja',
      'Loja',
      [
        [550, 550],
        [650, 550],
        [650, 650],
        [550, 650],
      ],
      [{ id: 30, label: '1', display_order: 1, seats: [seat(301, '1', 600, 600)] }],
    ),
  ],
};

export const fixtureSeatMap: EventSeatMapResponse = {
  seat_map: {
    id: 1,
    status: 'active',
    config_version: 3,
    hold_ttl_seconds: 600,
    max_seats_per_order: 10,
    currency: 'MDL',
    available_seats: 5,
    server_time: '2026-09-04T10:00:00Z',
  },
  layout: fixtureLayout,
  sections: [
    { section_id: 1, ticket_type_id: 7, is_active: true },
    { section_id: 2, ticket_type_id: 8, is_active: true },
    { section_id: 3, ticket_type_id: null, is_active: true },
  ],
  seat_categories: { '103': 9 },
  categories: [
    { ticket_type_id: 7, name: 'Parter', price: '900.00', color: '#02acf7' },
    { ticket_type_id: 8, name: 'Balcon', price: '500.00', color: '#47d055' },
    { ticket_type_id: 9, name: 'VIP', price: '1500.00', color: '#ffd336' },
  ],
  statuses: { sold: [102], reserved: [], blocked: [], disabled: [], unavailable: [301] },
  my_hold: null,
};

export function holdSeat(seatId: number, ticketTypeId: number, price: string, overrides: Partial<PricedHoldSeat> = {}): PricedHoldSeat {
  return {
    seat_id: seatId,
    section_id: 1,
    section_key: 'parter',
    section_name: 'Parter',
    row_label: '1',
    seat_label: String(seatId - 100),
    ticket_type_id: ticketTypeId,
    ticket_type_name: ticketTypeId === 7 ? 'Parter' : ticketTypeId === 8 ? 'Balcon' : 'VIP',
    price,
    ...overrides,
  };
}

export function unpricedHoldSeat(seatId: number, overrides: Partial<HoldSeat> = {}): HoldSeat {
  return { ...holdSeat(seatId, 7, '900.00'), ticket_type_id: null, ticket_type_name: null, price: null, ...overrides };
}

export function holdPayload(overrides: Partial<SeatHoldPayload> = {}): SeatHoldPayload {
  return {
    hold_token: 'hold-token-1',
    status: 'active',
    expires_at: '2026-09-04T10:10:00Z',
    max_expires_at: '2026-09-04T10:30:00Z',
    server_time: '2026-09-04T10:00:00Z',
    seats: [holdSeat(101, 7, '900.00')],
    total: '900.00',
    currency: 'MDL',
    order_id: null,
    ...overrides,
  };
}
