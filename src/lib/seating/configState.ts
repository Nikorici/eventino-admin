import { replaceStatuses, type SeatStatusMap } from '@/lib/seating/status';
import type { SeatIndex } from '@/lib/seating/seatIndex';
import type {
  SeatBlockStatus,
  SeatCategory,
  SeatMapConfigPayload,
  SeatMapConfigResponse,
  SeatMapConfigSection,
  SeatMapConfigStatuses,
  SeatMapConfigTicketType,
  SeatMapStatus,
  VenueLayoutDetail,
} from '@/types/seating';

export const CATEGORY_PALETTE = [
  '#02acf7',
  '#47d055',
  '#ffd336',
  '#74dcf3',
  '#fb9803',
  '#dd1007',
  '#9c2ea0',
  '#238a2d',
  '#022b95',
  '#e85ca7',
];

export const DEFAULT_HOLD_TTL_SECONDS = 600;
export const DEFAULT_MAX_SEATS_PER_ORDER = 10;

export interface DraftBlock {
  seat_id: number;
  status: SeatBlockStatus;
  note: string;
}

export interface ConfigDraft {
  layout_id: number | null;
  status: SeatMapStatus;
  hold_ttl_seconds: number;
  max_seats_per_order: number;
  category_colors: Record<string, string>;
  sections: SeatMapConfigSection[];
  rowRules: Map<number, number>;
  seatRules: Map<number, number>;
  blocks: Map<number, DraftBlock>;
}

export function emptyDraft(): ConfigDraft {
  return {
    layout_id: null,
    status: 'draft',
    hold_ttl_seconds: DEFAULT_HOLD_TTL_SECONDS,
    max_seats_per_order: DEFAULT_MAX_SEATS_PER_ORDER,
    category_colors: {},
    sections: [],
    rowRules: new Map(),
    seatRules: new Map(),
    blocks: new Map(),
  };
}

export function sectionsFromLayout(layout: VenueLayoutDetail): SeatMapConfigSection[] {
  return layout.sections.map((section) => ({
    section_id: section.id,
    key: section.key,
    name: section.name,
    seat_count: section.rows.reduce((sum, row) => sum + row.seats.length, 0),
    ticket_type_id: null,
    is_active: true,
  }));
}

export function draftFromConfig(config: SeatMapConfigResponse): ConfigDraft {
  const draft = emptyDraft();
  if (!config.seat_map) return draft;
  draft.layout_id = config.seat_map.layout_id;
  draft.status = config.seat_map.status;
  draft.hold_ttl_seconds = config.seat_map.hold_ttl_seconds;
  draft.max_seats_per_order = config.seat_map.max_seats_per_order;
  draft.category_colors = { ...(config.seat_map.category_colors ?? {}) };
  draft.sections = config.sections.map((section) => ({ ...section }));
  config.category_rules.forEach((rule) => {
    if (rule.row_id !== null) draft.rowRules.set(rule.row_id, rule.ticket_type_id);
    else if (rule.seat_id !== null) draft.seatRules.set(rule.seat_id, rule.ticket_type_id);
  });
  config.blocks.forEach((block) => {
    draft.blocks.set(block.seat_id, { seat_id: block.seat_id, status: block.status, note: block.note ?? '' });
  });
  return draft;
}

export function toPayload(draft: ConfigDraft): SeatMapConfigPayload {
  const payload: SeatMapConfigPayload = {
    status: draft.status,
    hold_ttl_seconds: draft.hold_ttl_seconds,
    max_seats_per_order: draft.max_seats_per_order,
    category_colors: { ...draft.category_colors },
    sections: draft.sections.map((section) => ({
      section_id: section.section_id,
      ticket_type_id: section.ticket_type_id,
      is_active: section.is_active,
    })),
    category_rules: [
      ...Array.from(draft.rowRules.entries()).map(([row_id, ticket_type_id]) => ({ row_id, ticket_type_id })),
      ...Array.from(draft.seatRules.entries()).map(([seat_id, ticket_type_id]) => ({ seat_id, ticket_type_id })),
    ],
    blocks: Array.from(draft.blocks.values()).map((block) => ({ seat_id: block.seat_id, status: block.status, note: block.note })),
  };
  if (draft.layout_id !== null) payload.layout_id = draft.layout_id;
  return payload;
}

export function seatCategoriesFromRules(
  layout: VenueLayoutDetail,
  rowRules: Map<number, number>,
  seatRules: Map<number, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (rowRules.size > 0) {
    layout.sections.forEach((section) => {
      section.rows.forEach((row) => {
        const ticketTypeId = rowRules.get(row.id);
        if (ticketTypeId === undefined) return;
        row.seats.forEach((seat) => {
          result[String(seat.id)] = ticketTypeId;
        });
      });
    });
  }
  seatRules.forEach((ticketTypeId, seatId) => {
    result[String(seatId)] = ticketTypeId;
  });
  return result;
}

export function categoriesForTicketTypes(ticketTypes: SeatMapConfigTicketType[], colors: Record<string, string>): SeatCategory[] {
  const ranked = [...ticketTypes].sort((a, b) => Number(a.price) - Number(b.price) || a.id - b.id);
  return ranked.map((ticketType, rank) => ({
    ticket_type_id: ticketType.id,
    name: ticketType.name,
    price: String(ticketType.price),
    color: colors[String(ticketType.id)] ?? CATEGORY_PALETTE[rank % CATEGORY_PALETTE.length],
  }));
}

export function statusMapFromConfig(statuses: SeatMapConfigStatuses | null | undefined, blocks: Map<number, DraftBlock>): SeatStatusMap {
  const blocked: number[] = [];
  const disabled: number[] = [];
  const unavailable: number[] = [];
  blocks.forEach((block) => {
    if (block.status === 'blocked') blocked.push(block.seat_id);
    else if (block.status === 'disabled') disabled.push(block.seat_id);
    else unavailable.push(block.seat_id);
  });
  return replaceStatuses(new Map(), {
    sold: statuses?.sold ?? [],
    reserved: statuses?.reserved ?? [],
    blocked,
    disabled,
    unavailable,
  });
}

export function toggleBlock(blocks: Map<number, DraftBlock>, seatId: number): Map<number, DraftBlock> {
  const next = new Map(blocks);
  if (next.has(seatId)) next.delete(seatId);
  else next.set(seatId, { seat_id: seatId, status: 'blocked', note: '' });
  return next;
}

export function toggleSeatRule(seatRules: Map<number, number>, seatId: number, ticketTypeId: number): Map<number, number> {
  const next = new Map(seatRules);
  if (next.get(seatId) === ticketTypeId) next.delete(seatId);
  else next.set(seatId, ticketTypeId);
  return next;
}

export function setRowRule(rowRules: Map<number, number>, rowId: number, ticketTypeId: number | null): Map<number, number> {
  const next = new Map(rowRules);
  if (ticketTypeId === null) next.delete(rowId);
  else next.set(rowId, ticketTypeId);
  return next;
}

export function usedTicketTypeIds(draft: ConfigDraft): number[] {
  const ids = new Set<number>();
  draft.sections.forEach((section) => {
    if (section.ticket_type_id !== null) ids.add(section.ticket_type_id);
  });
  draft.rowRules.forEach((id) => ids.add(id));
  draft.seatRules.forEach((id) => ids.add(id));
  return Array.from(ids);
}

export function isEligibleTicketType(ticketType: SeatMapConfigTicketType): boolean {
  return ticketType.qr_code_quantity === 1;
}

export const CONFIG_ERROR_MESSAGES: Record<string, string> = {
  activate_requires_sections: 'Assign a ticket type to at least one section before activating the seat map',
  layout_not_active: 'The selected venue layout is not active',
  legacy_zones_present: 'This event already uses a zone map. Remove the zones before adding a seat map.',
  seats_in_use: 'Seats are already sold or reserved for this event, so the layout cannot be changed',
  seat_allocated: 'One of the seats you are blocking is already sold or reserved',
  qr_quantity: 'Ticket types used on a seat map must issue exactly one QR code per ticket',
};

export function configErrorMessage(code: string | null | undefined, fallback: string | null | undefined): string {
  if (code && CONFIG_ERROR_MESSAGES[code]) return CONFIG_ERROR_MESSAGES[code];
  return fallback || 'Update failed';
}

export interface TicketTypeSummary {
  ticket_type_id: number;
  seats: number;
  revenue: number;
}

export interface DraftSummary {
  totalSeats: number;
  sellableSeats: number;
  unassignedSeats: number;
  blockedSeats: number;
  soldSeats: number;
  reservedSeats: number;
  potentialRevenue: number;
  byTicketType: TicketTypeSummary[];
}

export function summarizeDraft(
  index: SeatIndex | null,
  categories: Map<number, SeatCategory>,
  blocks: Map<number, DraftBlock>,
  statuses: SeatMapConfigStatuses | null | undefined,
): DraftSummary {
  const byTicketType = new Map<number, TicketTypeSummary>();
  let totalSeats = 0;
  let sellableSeats = 0;
  let unassignedSeats = 0;
  let potentialRevenue = 0;
  if (index) {
    index.seats.forEach((entry) => {
      totalSeats += 1;
      if (blocks.has(entry.id)) return;
      if (entry.ticketTypeId === null) {
        unassignedSeats += 1;
        return;
      }
      const category = categories.get(entry.ticketTypeId);
      const price = category ? Number(category.price) || 0 : 0;
      sellableSeats += 1;
      potentialRevenue += price;
      const current = byTicketType.get(entry.ticketTypeId) ?? { ticket_type_id: entry.ticketTypeId, seats: 0, revenue: 0 };
      current.seats += 1;
      current.revenue += price;
      byTicketType.set(entry.ticketTypeId, current);
    });
  }
  return {
    totalSeats,
    sellableSeats,
    unassignedSeats,
    blockedSeats: blocks.size,
    soldSeats: statuses?.sold.length ?? 0,
    reservedSeats: statuses?.reserved.length ?? 0,
    potentialRevenue,
    byTicketType: Array.from(byTicketType.values()).sort((a, b) => b.revenue - a.revenue || b.seats - a.seats),
  };
}

export interface ReadinessCheck {
  key: 'layout' | 'sections' | 'live';
  done: boolean;
  configured: number;
  total: number;
}

export function readinessChecks(draft: ConfigDraft): ReadinessCheck[] {
  const onSale = draft.sections.filter((section) => section.is_active);
  const configured = onSale.filter((section) => section.ticket_type_id !== null).length;
  return [
    { key: 'layout', done: draft.layout_id !== null, configured: draft.layout_id !== null ? 1 : 0, total: 1 },
    { key: 'sections', done: onSale.length > 0 && configured === onSale.length, configured, total: onSale.length },
    { key: 'live', done: draft.status === 'active', configured: draft.status === 'active' ? 1 : 0, total: 1 },
  ];
}

export function setAllSectionsTicketType(sections: SeatMapConfigSection[], ticketTypeId: number | null): SeatMapConfigSection[] {
  return sections.map((section) => ({ ...section, ticket_type_id: ticketTypeId }));
}
