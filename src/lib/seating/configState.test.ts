import { buildSeatIndex } from './seatIndex';
import { categoriesById } from './selection';
import {
  categoriesForTicketTypes,
  draftFromConfig,
  emptyDraft,
  readinessChecks,
  seatCategoriesFromRules,
  sectionsFromLayout,
  setRowRule,
  statusMapFromConfig,
  summarizeDraft,
  toPayload,
  toggleBlock,
  toggleSeatRule,
  usedTicketTypeIds,
} from './configState';
import type { SeatMapConfigResponse, VenueLayoutDetail } from '@/types/seating';

const layout: VenueLayoutDetail = {
  id: 3,
  name: 'Hall',
  slug: 'hall',
  status: 'active',
  venue: { id: 1, name: 'Palace', location: 'Chișinău' } as VenueLayoutDetail['venue'],
  canvas: { width: 400, height: 300 },
  seat_radius: 6,
  elements: [],
  sections: [
    {
      id: 10,
      key: 'A',
      name: 'Section A',
      outline: [],
      rows: [
        { id: 100, label: '1', seats: [{ id: 1001, label: '1', x: 10, y: 10, is_accessible: false }, { id: 1002, label: '2', x: 20, y: 10, is_accessible: false }] },
        { id: 101, label: '2', seats: [{ id: 1003, label: '1', x: 10, y: 20, is_accessible: false }] },
      ],
    } as unknown as VenueLayoutDetail['sections'][number],
  ],
};

const ticketTypes = [
  { id: 7, name: 'VIP', price: '100.00', qr_code_quantity: 1, is_active: true },
  { id: 8, name: 'Standard', price: '50.00', qr_code_quantity: 1, is_active: true },
];

function config(): SeatMapConfigResponse {
  return {
    seat_map: {
      id: 1,
      status: 'draft',
      layout_id: 3,
      hold_ttl_seconds: 300,
      hold_max_lifetime_seconds: 0,
      payment_ttl_seconds: 0,
      deferred_payment_ttl_seconds: 0,
      max_seats_per_order: 4,
      max_active_holds_per_identity: 0,
      category_colors: { '7': '#123456' },
      config_version: 1,
    },
    layout,
    sections: [{ section_id: 10, key: 'A', name: 'Section A', seat_count: 3, ticket_type_id: 8, is_active: true }],
    category_rules: [
      { id: 1, row_id: 101, seat_id: null, ticket_type_id: 7 },
      { id: 2, row_id: null, seat_id: 1002, ticket_type_id: 7 },
    ],
    blocks: [{ seat_id: 1001, status: 'blocked', note: '' }],
    statuses: { sold: [1003], reserved: [] },
    ticket_types: ticketTypes,
    layouts: [],
  };
}

describe('seat map config draft', () => {
  it('round-trips a config into a draft and payload', () => {
    const draft = draftFromConfig(config());
    expect(draft.layout_id).toBe(3);
    expect(draft.rowRules.get(101)).toBe(7);
    expect(draft.seatRules.get(1002)).toBe(7);
    expect(draft.blocks.get(1001)?.status).toBe('blocked');
    const payload = toPayload(draft);
    expect(payload.layout_id).toBe(3);
    expect(payload.category_rules).toEqual([
      { row_id: 101, ticket_type_id: 7 },
      { seat_id: 1002, ticket_type_id: 7 },
    ]);
    expect(payload.blocks).toEqual([{ seat_id: 1001, status: 'blocked', note: '' }]);
  });

  it('starts empty without a saved seat map and lists layout sections', () => {
    const draft = draftFromConfig({ ...config(), seat_map: null });
    expect(draft).toEqual(emptyDraft());
    expect(sectionsFromLayout(layout)).toEqual([{ section_id: 10, key: 'A', name: 'Section A', seat_count: 3, ticket_type_id: null, is_active: true }]);
  });

  it('resolves row and seat overrides into seat categories', () => {
    const draft = draftFromConfig(config());
    expect(seatCategoriesFromRules(layout, draft.rowRules, draft.seatRules)).toEqual({ '1003': 7, '1002': 7 });
  });

  it('toggles rules and blocks without mutating the previous map', () => {
    const rules = new Map<number, number>();
    const next = toggleSeatRule(rules, 1001, 7);
    expect(next.get(1001)).toBe(7);
    expect(rules.size).toBe(0);
    expect(toggleSeatRule(next, 1001, 7).has(1001)).toBe(false);
    expect(setRowRule(new Map([[100, 7]]), 100, null).size).toBe(0);
    const blocks = toggleBlock(new Map(), 1001);
    expect(blocks.get(1001)?.status).toBe('blocked');
    expect(toggleBlock(blocks, 1001).size).toBe(0);
  });

  it('summarizes seats, revenue and readiness', () => {
    const draft = draftFromConfig(config());
    const categories = categoriesById(categoriesForTicketTypes(ticketTypes, draft.category_colors));
    const index = buildSeatIndex(layout, draft.sections, seatCategoriesFromRules(layout, draft.rowRules, draft.seatRules));
    const summary = summarizeDraft(index, categories, draft.blocks, config().statuses);
    expect(summary.totalSeats).toBe(3);
    expect(summary.blockedSeats).toBe(1);
    expect(summary.sellableSeats).toBe(2);
    expect(summary.potentialRevenue).toBe(200);
    expect(summary.soldSeats).toBe(1);
    expect(usedTicketTypeIds(draft).sort()).toEqual([7, 8]);
    expect(readinessChecks(draft).map((check) => check.done)).toEqual([true, true, false]);
    expect(statusMapFromConfig(config().statuses, draft.blocks).get(1001)).toBe('blocked');
  });

  it('colours categories from saved colours or the palette by price rank', () => {
    const categories = categoriesForTicketTypes(ticketTypes, { '7': '#123456' });
    expect(categories.map((category) => [category.ticket_type_id, category.color])).toEqual([
      [8, '#02acf7'],
      [7, '#123456'],
    ]);
  });
});
