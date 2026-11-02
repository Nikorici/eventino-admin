import type { EventVenue, EventZone, Venue, VenueTemplate, VenueZone, ZonePatch } from '@/store/api/venueApi';
import type {
  PaymentLinkPayload,
  PaymentLinkTable,
  PaymentLinksOverview,
  TablePaymentLink,
} from '@/store/api/seatingApi';
import type {
  EventSeatMapSummary,
  LayoutSection,
  SeatBlock,
  SeatCategoryRule,
  SeatMapConfigInfo,
  SeatMapConfigPayload,
  SeatMapConfigResponse,
  SeatMapConfigSection,
  SeatMapConfigTicketType,
  VenueLayoutDetail,
  VenueLayoutListItem,
} from '@/types/seating';

import { currentMockUser, findMockEvent, type MockEvent } from './core';
import { bodyOf, isoDateTime, mock, mockError, type MockHandler, type MockResolver } from './mock';

interface SlotSpec {
  slot: string;
  name: string;
  color: string;
  capacity: number;
}

const TEMPLATE_SLOTS: Record<VenueTemplate, SlotSpec[]> = {
  standard_arena: [
    ...['202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212'].map((slot) => ({
      slot,
      name: `Sector ${slot}`,
      color: '#6fb2e0',
      capacity: 350,
    })),
    { slot: 'VIP-PARTERRE', name: 'VIP Parterre', color: '#ff6877', capacity: 200 },
    { slot: 'DIAMOND', name: 'Diamond', color: '#5bd6d3', capacity: 120 },
    { slot: 'BUSINESS', name: 'Business', color: '#4ed784', capacity: 150 },
    { slot: '104', name: '104 Business', color: '#4ed784', capacity: 90 },
    { slot: '110', name: '110 Business', color: '#4ed784', capacity: 90 },
    { slot: '107', name: '107 Business', color: '#4ed784', capacity: 90 },
  ],
  simple_3: [
    { slot: 'STANDARD', name: 'Standard', color: '#6fb2e0', capacity: 1000 },
    { slot: 'AVANTAJOS', name: 'Avantajos', color: '#f39c12', capacity: 400 },
    { slot: 'VIP', name: 'VIP', color: '#e74c3c', capacity: 100 },
  ],
  balcon: [
    { slot: 'BALCON', name: 'Balcon', color: '#4ade80', capacity: 300 },
    { slot: 'ARIPA_STANGA', name: 'Aripa Stângă', color: '#3b82f6', capacity: 200 },
    { slot: 'ARIPA_DREAPTA', name: 'Aripa Dreaptă', color: '#3b82f6', capacity: 200 },
    { slot: 'GENERAL_ACCESS', name: 'General Access', color: '#7c3aed', capacity: 600 },
  ],
};

const venues: Venue[] = [
  {
    id: 701,
    name: 'Festivalul Vinului — Ediția de Toamnă',
    location: 'Chișinău',
    capacity: 0,
    template: 'simple_3',
    zones: [
      { id: 7011, name: 'General Access', venue: 701, capacity: 1500, template_slot_id: 'STANDARD', color: '#6fb2e0', display_order: 1, is_active: true, comment: 'Standing area around the tasting stands' },
      { id: 7012, name: 'Terrace', venue: 701, capacity: 800, template_slot_id: 'AVANTAJOS', color: '#f39c12', display_order: 2, is_active: true, comment: 'Covered terrace with seating' },
      { id: 7013, name: 'VIP Lounge', venue: 701, capacity: 120, template_slot_id: 'VIP', color: '#e74c3c', display_order: 3, is_active: true, comment: 'Sommelier-led tastings and a private bar' },
    ],
  },
];

interface StoredEventVenue {
  id: number;
  event: number;
  venue: number;
  configuration_notes: string | null;
}

interface StoredEventZone {
  id: number;
  event_venue: number;
  zone: number;
  ticket_type: number;
  price_override: string | null;
  is_active_override: boolean | null;
}

const eventVenues: StoredEventVenue[] = [{ id: 801, event: 4101, venue: 701, configuration_notes: null }];

const eventZones: StoredEventZone[] = [
  { id: 901, event_venue: 801, zone: 7011, ticket_type: 51, price_override: null, is_active_override: null },
  { id: 902, event_venue: 801, zone: 7012, ticket_type: 52, price_override: null, is_active_override: null },
  { id: 903, event_venue: 801, zone: 7013, ticket_type: 53, price_override: null, is_active_override: null },
];

let nextId = 9500;
const newId = () => ++nextId;

function eventOfVenue(eventVenueId: number): MockEvent | undefined {
  const link = eventVenues.find((item) => item.id === eventVenueId);
  return link ? findMockEvent(link.event) : undefined;
}

function zoneById(zoneId: number): VenueZone | undefined {
  return venues.flatMap((venue) => venue.zones).find((zone) => zone.id === zoneId);
}

function toEventVenue(stored: StoredEventVenue): EventVenue | null {
  const venue = venues.find((item) => item.id === stored.venue);
  if (!venue) return null;
  return {
    ...stored,
    event_name: findMockEvent(stored.event)?.name ?? '',
    venue_details: { ...venue, zones: venue.zones.map((zone) => ({ ...zone })) },
  };
}

function toEventZone(stored: StoredEventZone): EventZone | null {
  const zone = zoneById(stored.zone);
  if (!zone) return null;
  const ticketType = eventOfVenue(stored.event_venue)?.ticketTypes.find((item) => item.id === stored.ticket_type);
  return {
    ...stored,
    zone_details: { ...zone },
    ticket_type_name: ticketType?.name ?? null,
    ticket_type_price: ticketType ? ticketType.price.toFixed(2) : null,
  };
}

function removeVenue(venueId: number) {
  const linkIds = eventVenues.filter((item) => item.venue === venueId).map((item) => item.id);
  for (let index = eventZones.length - 1; index >= 0; index -= 1) {
    if (linkIds.includes(eventZones[index].event_venue)) eventZones.splice(index, 1);
  }
  for (let index = eventVenues.length - 1; index >= 0; index -= 1) {
    if (eventVenues[index].venue === venueId) eventVenues.splice(index, 1);
  }
  const venueIndex = venues.findIndex((venue) => venue.id === venueId);
  if (venueIndex >= 0) venues.splice(venueIndex, 1);
}

interface SectionSpec {
  id: number;
  key: string;
  name: string;
  rows: number;
  seatsPerRow: number;
  x: number;
  y: number;
  spacing?: number;
  seatLabel?: (row: number, column: number) => string;
}

const SEAT_SPACING = 28;
const OUTLINE_PADDING = 20;

function buildSection(spec: SectionSpec, order: number): LayoutSection {
  const spacing = spec.spacing ?? SEAT_SPACING;
  const right = spec.x + (spec.seatsPerRow - 1) * spacing;
  const bottom = spec.y + (spec.rows - 1) * spacing;
  return {
    id: spec.id,
    key: spec.key,
    name: spec.name,
    name_i18n: null,
    color: '#6fb2e0',
    display_order: order,
    label: { x: (spec.x + right) / 2, y: spec.y - OUTLINE_PADDING - 12, rotation: 0, anchor: 'middle' },
    outline: [
      [spec.x - OUTLINE_PADDING, spec.y - OUTLINE_PADDING],
      [right + OUTLINE_PADDING, spec.y - OUTLINE_PADDING],
      [right + OUTLINE_PADDING, bottom + OUTLINE_PADDING],
      [spec.x - OUTLINE_PADDING, bottom + OUTLINE_PADDING],
    ],
    row_labels: { mode: spec.rows > 1 ? 'ends' : 'none', x: null },
    rows: Array.from({ length: spec.rows }, (_, row) => ({
      id: spec.id * 100 + row + 1,
      label: String(row + 1),
      display_order: row + 1,
      seats: Array.from({ length: spec.seatsPerRow }, (__, column) => ({
        id: spec.id * 10000 + row * 100 + column + 1,
        label: spec.seatLabel ? spec.seatLabel(row, column) : String(column + 1),
        x: spec.x + column * spacing,
        y: spec.y + row * spacing,
        is_accessible: row === spec.rows - 1 && column === 0 && spec.rows > 3,
        is_default_blocked: false,
      })),
    })),
  };
}

function buildLayout(
  base: Omit<VenueLayoutDetail, 'sections' | 'status' | 'elements'> & { stage: string },
  sections: SectionSpec[],
): VenueLayoutDetail {
  const { stage, ...rest } = base;
  return {
    ...rest,
    status: 'active',
    elements: [
      { type: 'stage', key: 'stage', x: base.canvas.width / 2 - 200, y: 30, width: 400, height: 56, radius: 10, label: stage },
    ],
    sections: sections.map(buildSection),
  };
}

const layouts: VenueLayoutDetail[] = [
  buildLayout(
    {
      id: 31,
      name: 'Parter și balcon',
      slug: 'sala-cu-orga-parter-balcon',
      venue: { id: 21, name: 'Sala cu Orgă', location: 'Chișinău, bd. Ștefan cel Mare 79' },
      canvas: { width: 1000, height: 820 },
      seat_radius: 11,
      stage: 'Scenă',
    },
    [
      { id: 3101, key: 'parter-a', name: 'Parter A', rows: 10, seatsPerRow: 12, x: 130, y: 160 },
      { id: 3102, key: 'parter-b', name: 'Parter B', rows: 11, seatsPerRow: 12, x: 562, y: 160 },
      { id: 3103, key: 'balcon', name: 'Balcon', rows: 4, seatsPerRow: 26, x: 150, y: 540 },
      { id: 3104, key: 'loje', name: 'Loje', rows: 2, seatsPerRow: 8, x: 402, y: 720 },
    ],
  ),
  buildLayout(
    {
      id: 32,
      name: 'Sala Mare',
      slug: 'palatul-national-sala-mare',
      venue: { id: 22, name: 'Palatul Național «Nicolae Sulac»', location: 'Chișinău, str. Pușkin 21' },
      canvas: { width: 1000, height: 820 },
      seat_radius: 11,
      stage: 'Scenă',
    },
    [
      { id: 3201, key: 'parter', name: 'Parter', rows: 12, seatsPerRow: 24, x: 178, y: 160 },
      { id: 3202, key: 'balcon', name: 'Balcon', rows: 6, seatsPerRow: 26, x: 150, y: 560 },
    ],
  ),
  buildLayout(
    {
      id: 33,
      name: 'Mese la scenă',
      slug: 'fix-club-mese',
      venue: { id: 23, name: 'Fix Club', location: 'Iași, str. Lăpușneanu 14' },
      canvas: { width: 1000, height: 640 },
      seat_radius: 26,
      stage: 'Scenă',
    },
    [
      { id: 3301, key: 'langa-scena', name: 'Lângă scenă', rows: 1, seatsPerRow: 6, x: 225, y: 190, spacing: 110, seatLabel: (_row, column) => String(column + 1) },
      { id: 3302, key: 'sala', name: 'Sala', rows: 2, seatsPerRow: 4, x: 335, y: 380, spacing: 110, seatLabel: (row, column) => String(7 + row * 4 + column) },
    ],
  ),
];

const SEAT_LAYOUT_IDS = [31, 32];

function layoutById(id: number): VenueLayoutDetail | undefined {
  return layouts.find((layout) => layout.id === id);
}

function allSeatIds(layout: VenueLayoutDetail): number[] {
  return layout.sections.flatMap((section) => section.rows.flatMap((row) => row.seats.map((seat) => seat.id)));
}

function seatsOfRows(layout: VenueLayoutDetail, sectionId: number, rows: number[], take?: number): number[] {
  const section = layout.sections.find((item) => item.id === sectionId);
  const ids = (section?.rows ?? [])
    .filter((row) => rows.includes(Number(row.label)))
    .flatMap((row) => row.seats.map((seat) => seat.id));
  return take === undefined ? ids : ids.slice(0, take);
}

function listItem(layout: VenueLayoutDetail): VenueLayoutListItem {
  return {
    id: layout.id,
    name: layout.name,
    slug: layout.slug,
    status: layout.status,
    venue: layout.venue,
    canvas: layout.canvas,
    seat_count: allSeatIds(layout).length,
    section_count: layout.sections.length,
  };
}

function configTicketTypes(event: MockEvent): SeatMapConfigTicketType[] {
  return event.ticketTypes.map((ticketType) => ({
    id: ticketType.id,
    name: ticketType.name,
    price: ticketType.price.toFixed(2),
    qr_code_quantity: ticketType.extra?.qr_code_quantity ?? 1,
    is_active: ticketType.extra?.is_active ?? !event.isCancelled,
  }));
}

function sectionsOf(layout: VenueLayoutDetail, assign: Record<number, number | null>): SeatMapConfigSection[] {
  return layout.sections.map((section) => ({
    section_id: section.id,
    key: section.key,
    name: section.name,
    seat_count: section.rows.reduce((sum, row) => sum + row.seats.length, 0),
    ticket_type_id: assign[section.id] ?? null,
    is_active: true,
  }));
}

interface StoredConfig {
  seat_map: SeatMapConfigInfo | null;
  sections: SeatMapConfigSection[];
  category_rules: SeatCategoryRule[];
  blocks: SeatBlock[];
  sold: number[];
  reserved: number[];
}

function seatMapInfo(id: number, layoutId: number, scope: 'event' | 'tables', colors: Record<string, string>): SeatMapConfigInfo {
  return {
    id,
    status: 'active',
    layout_id: layoutId,
    hold_ttl_seconds: 600,
    hold_max_lifetime_seconds: 1800,
    payment_ttl_seconds: 900,
    deferred_payment_ttl_seconds: 86400,
    max_seats_per_order: scope === 'tables' ? 1 : 10,
    max_active_holds_per_identity: 3,
    category_colors: colors,
    config_version: 4,
    scope,
  };
}

const organLayout = layouts[0];
const tablesLayout = layouts[2];

const configs = new Map<number, StoredConfig>([
  [
    4102,
    {
      seat_map: seatMapInfo(61, 31, 'event', { '54': '#47d055', '55': '#02acf7', '56': '#9c2ea0' }),
      sections: sectionsOf(organLayout, { 3101: 55, 3102: 55, 3103: 54, 3104: 56 }),
      category_rules: [{ id: 1, row_id: 310101, seat_id: null, ticket_type_id: 56 }],
      blocks: seatsOfRows(organLayout, 3103, [4]).slice(-6).map((seat_id): SeatBlock => ({ seat_id, status: 'blocked', note: 'Cameră video' })),
      sold: [
        ...seatsOfRows(organLayout, 3101, [1, 2, 3, 4, 5, 6, 7, 8]),
        ...seatsOfRows(organLayout, 3102, [1, 2, 3, 4, 5, 6, 7]),
        ...seatsOfRows(organLayout, 3103, [1, 2], 30),
        ...seatsOfRows(organLayout, 3104, [1], 4),
      ],
      reserved: seatsOfRows(organLayout, 3102, [8], 4),
    },
  ],
  [
    4105,
    {
      seat_map: seatMapInfo(62, 33, 'tables', { '61': '#e85ca7', '62': '#02acf7' }),
      sections: sectionsOf(tablesLayout, { 3301: 61, 3302: 62 }),
      category_rules: [],
      blocks: [{ seat_id: 33020104, status: 'blocked', note: 'Rezervată pentru artiști' }],
      sold: [33010001, 33010002, 33020001],
      reserved: [],
    },
  ],
]);

function emptyConfig(): StoredConfig {
  return { seat_map: null, sections: [], category_rules: [], blocks: [], sold: [], reserved: [] };
}

function configResponse(event: MockEvent): SeatMapConfigResponse {
  const stored = configs.get(event.id) ?? emptyConfig();
  return {
    seat_map: stored.seat_map ? { ...stored.seat_map, category_colors: { ...stored.seat_map.category_colors } } : null,
    layout: stored.seat_map ? (layoutById(stored.seat_map.layout_id) ?? null) : null,
    sections: stored.sections.map((section) => ({ ...section })),
    category_rules: stored.category_rules.map((rule) => ({ ...rule })),
    blocks: stored.blocks.map((block) => ({ ...block })),
    statuses: { sold: [...stored.sold], reserved: [...stored.reserved, ...activeLinkSeats(event.id)] },
    ticket_types: configTicketTypes(event),
    layouts: (stored.seat_map?.scope === 'tables' ? [tablesLayout.id] : SEAT_LAYOUT_IDS)
      .map(layoutById)
      .filter((layout): layout is VenueLayoutDetail => Boolean(layout))
      .map(listItem),
  };
}

function summaryOf(event: MockEvent, stored: StoredConfig): EventSeatMapSummary | null {
  const info = stored.seat_map;
  const layout = info ? layoutById(info.layout_id) : undefined;
  if (!info || !layout) return null;
  const onSale = stored.sections.filter((section) => section.is_active);
  const prices = onSale
    .map((section) => event.ticketTypes.find((ticketType) => ticketType.id === section.ticket_type_id)?.price)
    .filter((price): price is number => price !== undefined);
  const sellable = onSale.reduce((sum, section) => sum + section.seat_count, 0);
  return {
    id: info.id,
    status: info.status,
    layout_id: layout.id,
    layout_name: layout.name,
    venue_name: layout.venue.name,
    hold_ttl_seconds: info.hold_ttl_seconds,
    max_seats_per_order: info.max_seats_per_order,
    seat_count: allSeatIds(layout).length,
    available_seats: Math.max(0, sellable - stored.sold.length - stored.reserved.length - stored.blocks.length),
    price_min: prices.length ? Math.min(...prices).toFixed(2) : null,
    price_max: prices.length ? Math.max(...prices).toFixed(2) : null,
  };
}

function syncEventSummary(event: MockEvent) {
  const stored = configs.get(event.id);
  const summary = stored ? summaryOf(event, stored) : null;
  const isTables = stored?.seat_map?.scope === 'tables';
  event.detail = { ...event.detail, seat_map: isTables ? null : summary, table_map: isTables ? summary : null };
}

interface StoredLink extends TablePaymentLink {
  event: number;
}

const SITE_URLS: Record<number, string> = { 4105: 'https://fixclub.ro' };

function tableName(seatId: number): string {
  const seat = tablesLayout.sections.flatMap((section) => section.rows.flatMap((row) => row.seats)).find((item) => item.id === seatId);
  return `Masa ${seat?.label ?? seatId}`;
}

function sectionOfSeat(layout: VenueLayoutDetail, seatId: number): LayoutSection | undefined {
  return layout.sections.find((section) => section.rows.some((row) => row.seats.some((seat) => seat.id === seatId)));
}

function linkFor(eventId: number, seatId: number, fields: Pick<TablePaymentLink, 'client_name' | 'note' | 'expires_at' | 'status' | 'order_id'> & { created_at: string }): StoredLink {
  const event = findMockEvent(eventId);
  const stored = configs.get(eventId);
  const section = sectionOfSeat(tablesLayout, seatId);
  const ticketTypeId = stored?.sections.find((item) => item.section_id === section?.id)?.ticket_type_id ?? null;
  const ticketType = event?.ticketTypes.find((item) => item.id === ticketTypeId);
  const id = newId();
  const token = `tbl_${id.toString(36)}${seatId.toString(36)}`;
  const site = SITE_URLS[eventId];
  return {
    id,
    event: eventId,
    token,
    url: site ? `${site}/plata-masa/${token}` : null,
    seat_id: seatId,
    section_id: section?.id ?? 0,
    table_name: tableName(seatId),
    ticket_type_id: ticketTypeId,
    ticket_type_name: ticketType?.name ?? null,
    price: ticketType ? ticketType.price.toFixed(2) : null,
    currency: event?.currency ?? 'MDL',
    cancelled_at: fields.status === 'cancelled' ? fields.created_at : null,
    ...fields,
  };
}

const paymentLinks: StoredLink[] = [
  linkFor(4105, 33010003, {
    client_name: 'Cristina Lungu',
    note: 'Aniversare, 6 persoane',
    expires_at: isoDateTime(2, '20:00:00'),
    created_at: isoDateTime(-1, '11:20:00'),
    status: 'active',
    order_id: null,
  }),
  linkFor(4105, 33020001, {
    client_name: 'Vlad Munteanu',
    note: '',
    expires_at: isoDateTime(-2, '18:00:00'),
    created_at: isoDateTime(-4, '09:45:00'),
    status: 'paid',
    order_id: 88231,
  }),
  linkFor(4105, 33020003, {
    client_name: 'Echipa Endava Iași',
    note: 'Team building',
    expires_at: isoDateTime(-1, '12:00:00'),
    created_at: isoDateTime(-3, '15:10:00'),
    status: 'expired',
    order_id: null,
  }),
];

function activeLinkSeats(eventId: number): number[] {
  return paymentLinks
    .filter((link) => link.event === eventId && (link.status === 'active' || link.status === 'paying'))
    .map((link) => link.seat_id);
}

function tableStatus(stored: StoredConfig, eventId: number, seatId: number): PaymentLinkTable['status'] {
  if (stored.sold.includes(seatId)) return 'sold';
  if (activeLinkSeats(eventId).includes(seatId)) return 'linked';
  if (stored.reserved.includes(seatId)) return 'reserved';
  if (stored.blocks.some((block) => block.seat_id === seatId)) return 'blocked';
  return 'available';
}

function overviewFor(event: MockEvent, stored: StoredConfig): PaymentLinksOverview {
  const tables: PaymentLinkTable[] = tablesLayout.sections.flatMap((section) => {
    const config = stored.sections.find((item) => item.section_id === section.id);
    const ticketType = event.ticketTypes.find((item) => item.id === config?.ticket_type_id);
    return section.rows.flatMap((row) =>
      row.seats.map((seat) => {
        const status = config?.is_active === false ? 'unavailable' : tableStatus(stored, event.id, seat.id);
        return {
          seat_id: seat.id,
          section_id: section.id,
          name: `Masa ${seat.label}`,
          name_i18n: { ro: `Masa ${seat.label}`, ru: `Стол ${seat.label}`, en: `Table ${seat.label}` },
          ticket_type_id: ticketType?.id ?? null,
          ticket_type_name: ticketType?.name ?? null,
          price: ticketType ? ticketType.price.toFixed(2) : null,
          status,
          linkable: (status === 'available' || status === 'blocked') && Boolean(ticketType),
        };
      }),
    );
  });
  return {
    currency: event.currency,
    site_url: SITE_URLS[event.id] ?? null,
    tables,
    links: paymentLinks
      .filter((link) => link.event === event.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ event: _event, ...link }) => link),
  };
}

[4102, 4105].forEach((id) => {
  const event = findMockEvent(id);
  if (event) syncEventSummary(event);
});

function applyConfig(event: MockEvent, payload: Partial<SeatMapConfigPayload>): StoredConfig | { code: string; message: string } {
  const previous = configs.get(event.id) ?? emptyConfig();
  const layoutId = payload.layout_id ?? previous.seat_map?.layout_id;
  const layout = layoutId ? layoutById(layoutId) : undefined;
  if (!layout) return { code: 'layout_not_active', message: 'The selected venue layout is not active' };
  if (eventVenues.some((item) => item.event === event.id)) {
    return { code: 'legacy_zones_present', message: 'This event already uses a zone map.' };
  }
  if (previous.seat_map && previous.seat_map.layout_id !== layout.id && previous.sold.length > 0) {
    return { code: 'seats_in_use', message: 'Seats are already sold.' };
  }
  const sameLayout = previous.seat_map?.layout_id === layout.id;
  const base = sectionsOf(layout, {});
  const sections = base.map((section) => {
    const next = payload.sections?.find((item) => item.section_id === section.section_id);
    return next ? { ...section, ticket_type_id: next.ticket_type_id, is_active: next.is_active } : section;
  });
  const status = payload.status ?? previous.seat_map?.status ?? 'draft';
  if (status === 'active' && !sections.some((section) => section.is_active && section.ticket_type_id !== null)) {
    return { code: 'activate_requires_sections', message: 'Assign a ticket type to at least one section.' };
  }
  const blocks = (payload.blocks ?? []).map((block) => ({ seat_id: block.seat_id, status: block.status, note: block.note ?? '' }));
  const sold = sameLayout ? previous.sold : [];
  const reserved = sameLayout ? previous.reserved : [];
  if (blocks.some((block) => sold.includes(block.seat_id) || reserved.includes(block.seat_id))) {
    return { code: 'seat_allocated', message: 'One of the seats is already sold or reserved.' };
  }
  const scope = layout.id === tablesLayout.id ? 'tables' : 'event';
  const info: SeatMapConfigInfo = {
    ...(previous.seat_map ?? seatMapInfo(newId(), layout.id, scope, {})),
    layout_id: layout.id,
    status,
    hold_ttl_seconds: payload.hold_ttl_seconds ?? previous.seat_map?.hold_ttl_seconds ?? 600,
    max_seats_per_order: payload.max_seats_per_order ?? previous.seat_map?.max_seats_per_order ?? 10,
    category_colors: { ...(payload.category_colors ?? previous.seat_map?.category_colors ?? {}) },
    config_version: (previous.seat_map?.config_version ?? 0) + 1,
    scope,
  };
  return {
    seat_map: info,
    sections,
    category_rules: (payload.category_rules ?? []).map((rule, index) => ({
      id: index + 1,
      row_id: rule.row_id ?? null,
      seat_id: rule.seat_id ?? null,
      ticket_type_id: rule.ticket_type_id,
    })),
    blocks,
    sold,
    reserved,
  };
}

function adminOnly(resolve: MockResolver): MockResolver {
  return (request) =>
    currentMockUser(request).is_staff
      ? resolve(request)
      : mockError(403, { detail: 'You do not have permission to perform this action.' });
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/event-venues/by_event/', ({ query }) =>
    eventVenues
      .filter((item) => item.event === Number(query.event_id))
      .map(toEventVenue)
      .filter((item): item is EventVenue => item !== null),
  ),
  mock('GET', '/api/v1/event-zones/by_event/', ({ query }) => {
    const linkIds = eventVenues.filter((item) => item.event === Number(query.event_id)).map((item) => item.id);
    return eventZones
      .filter((item) => linkIds.includes(item.event_venue))
      .map(toEventZone)
      .filter((item): item is EventZone => item !== null);
  }),
  mock('POST', '/api/v1/venues/', adminOnly((request) => {
    const body = bodyOf<{ name: string; location: string; capacity: number; template: VenueTemplate }>(request);
    const slots = body.template ? TEMPLATE_SLOTS[body.template] : undefined;
    if (!slots) return mockError(400, { error: 'Invalid template' });
    const id = newId();
    const venue: Venue = {
      id,
      name: body.name || 'Event venue',
      location: body.location ?? '',
      capacity: body.capacity ?? 0,
      template: body.template ?? '',
      zones: slots.map((slot, index) => ({
        id: newId(),
        name: slot.name,
        venue: id,
        capacity: slot.capacity,
        template_slot_id: slot.slot,
        color: slot.color,
        display_order: index + 1,
        is_active: true,
        comment: '',
      })),
    };
    venues.push(venue);
    return { ...venue, zones: venue.zones.map((zone) => ({ ...zone })) };
  })),
  mock('DELETE', '/api/v1/venues/:id/', adminOnly(({ params }) => {
    if (!venues.some((venue) => venue.id === Number(params.id))) return mockError(404, { detail: 'No Venue matches the given query.' });
    if (eventVenues.some((item) => item.venue === Number(params.id))) return mockError(409, { error: 'Venue is in use' });
    removeVenue(Number(params.id));
    return {};
  })),
  mock('POST', '/api/v1/event-venues/assign_venue/', adminOnly((request) => {
    const body = bodyOf<{ event_id: number; venue_id: number }>(request);
    const eventId = Number(body.event_id);
    if (!findMockEvent(eventId) || !venues.some((venue) => venue.id === Number(body.venue_id))) {
      return mockError(400, { error: 'Event or venue not found.' });
    }
    if ((configs.get(eventId)?.seat_map ?? null) !== null) {
      return mockError(400, { error: 'This event already uses a seat map.' });
    }
    eventVenues
      .filter((item) => item.event === eventId)
      .map((item) => item.venue)
      .forEach(removeVenue);
    const stored: StoredEventVenue = { id: newId(), event: eventId, venue: Number(body.venue_id), configuration_notes: null };
    eventVenues.push(stored);
    return toEventVenue(stored);
  })),
  mock('PATCH', '/api/v1/zones/:id/', adminOnly((request) => {
    const zoneId = Number(request.params.id);
    const venue = venues.find((item) => item.zones.some((zone) => zone.id === zoneId));
    if (!venue) return mockError(404, { detail: 'Not found.' });
    const patch = bodyOf<ZonePatch>(request);
    if (patch.name !== undefined && !patch.name.trim()) return mockError(400, { name: ['This field may not be blank.'] });
    venue.zones = venue.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone));
    const updated = venue.zones.find((zone) => zone.id === zoneId);
    return updated ? { ...updated } : {};
  })),
  mock('POST', '/api/v1/event-zones/assign_to_event/', adminOnly((request) => {
    const body = bodyOf<{ event_venue_id: number; zone_id: number; ticket_type_id: number }>(request);
    const eventVenueId = Number(body.event_venue_id);
    if (!eventVenues.some((item) => item.id === eventVenueId) || !zoneById(Number(body.zone_id))) {
      return mockError(400, { error: 'Zone not found.' });
    }
    const stored: StoredEventZone = {
      id: newId(),
      event_venue: eventVenueId,
      zone: Number(body.zone_id),
      ticket_type: Number(body.ticket_type_id),
      price_override: null,
      is_active_override: null,
    };
    eventZones.push(stored);
    return toEventZone(stored);
  })),
  mock('PATCH', '/api/v1/event-zones/:id/', adminOnly((request) => {
    const stored = eventZones.find((item) => item.id === Number(request.params.id));
    if (!stored) return mockError(404, { detail: 'Not found.' });
    const patch = bodyOf<{ ticket_type: number | null; price_override: number | null }>(request);
    if (patch.ticket_type != null) stored.ticket_type = Number(patch.ticket_type);
    if (patch.price_override !== undefined) {
      stored.price_override = patch.price_override === null ? null : Number(patch.price_override).toFixed(2);
    }
    return toEventZone(stored);
  })),
  mock('DELETE', '/api/v1/event-zones/:id/', adminOnly(({ params }) => {
    const index = eventZones.findIndex((item) => item.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    eventZones.splice(index, 1);
    return {};
  })),
  mock('GET', '/api/v1/venue-layouts/:id/', ({ params }) => layoutById(Number(params.id)) ?? mockError(404, { detail: 'Not found.' })),
  mock('GET', '/api/v1/events/:id/seat-map/config/', ({ params }) => {
    const event = findMockEvent(params.id);
    return event ? configResponse(event) : mockError(404, { detail: 'Not found.' });
  }),
  mock(
    'PUT',
    '/api/v1/events/:id/seat-map/config/',
    (request) => {
      const event = findMockEvent(request.params.id);
      if (!event) return mockError(404, { detail: 'Not found.' });
      const result = applyConfig(event, bodyOf<SeatMapConfigPayload>(request));
      if ('code' in result) return mockError(400, result);
      configs.set(event.id, result);
      syncEventSummary(event);
      return configResponse(event);
    },
    { delay: 700 },
  ),
  mock('DELETE', '/api/v1/events/:id/seat-map/config/', ({ params }) => {
    const event = findMockEvent(params.id);
    if (!event) return mockError(404, { detail: 'Not found.' });
    configs.delete(event.id);
    syncEventSummary(event);
    return { success: true };
  }),
  mock('GET', '/api/v1/events/:id/seat-map/payment-links/', ({ params }) => {
    const event = findMockEvent(params.id);
    const stored = event ? configs.get(event.id) : undefined;
    if (!event || stored?.seat_map?.scope !== 'tables') {
      return mockError(404, { detail: 'This event has no table map', code: 'no_table_map' });
    }
    return overviewFor(event, stored);
  }),
  mock('POST', '/api/v1/events/:id/seat-map/payment-links/', (request) => {
    const event = findMockEvent(request.params.id);
    const stored = event ? configs.get(event.id) : undefined;
    if (!event || !stored || stored.seat_map?.scope !== 'tables') {
      return mockError(404, { detail: 'This event has no table map', code: 'no_table_map' });
    }
    const body = bodyOf<PaymentLinkPayload>(request);
    const table = overviewFor(event, stored).tables.find((item) => item.seat_id === Number(body.seat_id));
    if (!table) return mockError(400, { detail: 'This table is not on the event map', code: 'invalid_seat' });
    const clientName = body.client_name?.trim() ?? '';
    if (!clientName || !body.expires_at) return mockError(400, { detail: 'Invalid payment link', code: 'invalid_request' });
    if (new Date(body.expires_at).getTime() <= Date.now()) return mockError(400, { detail: 'Choose an expiry date in the future', code: 'expires_in_past' });
    if (table.status === 'linked') return mockError(409, { detail: 'This table already has an active payment link', code: 'link_exists' });
    if (!table.linkable) return mockError(409, { detail: 'This table is sold or someone is paying for it right now', code: 'table_unavailable' });
    const link = linkFor(event.id, table.seat_id, {
      client_name: clientName,
      note: body.note?.trim() ?? '',
      expires_at: body.expires_at,
      created_at: new Date().toISOString(),
      status: 'active',
      order_id: null,
    });
    paymentLinks.push(link);
    const { event: _event, ...response } = link;
    return response;
  }),
  mock('POST', '/api/v1/events/:id/seat-map/payment-links/:linkId/cancel/', ({ params }) => {
    const link = paymentLinks.find((item) => item.id === Number(params.linkId) && item.event === Number(params.id));
    if (!link) return mockError(404, { detail: 'Payment link not found', code: 'link_not_found' });
    if (link.status === 'paid') return mockError(409, { detail: 'This table is already paid', code: 'link_paid' });
    link.status = 'cancelled';
    link.cancelled_at = new Date().toISOString();
    const { event: _event, ...response } = link;
    return response;
  }),
];
