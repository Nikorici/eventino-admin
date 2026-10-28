import type { HoldSeat, PricedHoldSeat, SeatCategory } from '@/types/seating';

import type { IndexedSeat } from './seatIndex';

export type SelectionAction =
  | { type: 'toggle'; seat: PricedHoldSeat; max: number }
  | { type: 'remove'; seatId: number }
  | { type: 'removeMany'; seatIds: number[] }
  | { type: 'replaceFromHold'; seats: PricedHoldSeat[] }
  | { type: 'clear' };

export function selectionReducer(state: PricedHoldSeat[], action: SelectionAction): PricedHoldSeat[] {
  switch (action.type) {
    case 'toggle': {
      const existing = state.findIndex((seat) => seat.seat_id === action.seat.seat_id);
      if (existing >= 0) return state.filter((_seat, index) => index !== existing);
      if (state.length >= action.max) return state;
      return [...state, action.seat];
    }
    case 'remove': {
      if (!state.some((seat) => seat.seat_id === action.seatId)) return state;
      return state.filter((seat) => seat.seat_id !== action.seatId);
    }
    case 'removeMany': {
      const removed = new Set(action.seatIds);
      if (!state.some((seat) => removed.has(seat.seat_id))) return state;
      return state.filter((seat) => !removed.has(seat.seat_id));
    }
    case 'replaceFromHold':
      return [...action.seats];
    case 'clear':
      return state.length === 0 ? state : [];
  }
}

export function isSeatSelected(state: HoldSeat[], seatId: number): boolean {
  return state.some((seat) => seat.seat_id === seatId);
}

export function selectedSeatIds(state: HoldSeat[]): number[] {
  return state.map((seat) => seat.seat_id);
}

export function isPricedSeat(seat: HoldSeat): seat is PricedHoldSeat {
  return seat.ticket_type_id != null && seat.ticket_type_name != null && seat.price != null;
}

export function categoriesById(categories: SeatCategory[]): Map<number, SeatCategory> {
  return new Map(categories.map((category) => [category.ticket_type_id, category]));
}

export function toHoldSeat(seat: IndexedSeat, categories: Map<number, SeatCategory>): PricedHoldSeat | null {
  if (seat.ticketTypeId == null) return null;
  const category = categories.get(seat.ticketTypeId);
  if (!category) return null;
  return {
    seat_id: seat.id,
    section_id: seat.sectionId,
    section_key: seat.sectionKey,
    section_name: seat.sectionName,
    row_label: seat.rowLabel,
    seat_label: seat.label,
    ticket_type_id: category.ticket_type_id,
    ticket_type_name: category.name,
    price: category.price,
  };
}

export interface SeatLine {
  ticket_type_id: number;
  name: string;
  price: string;
  seat_ids: number[];
  seats: PricedHoldSeat[];
}

export function groupIntoLines(seats: HoldSeat[]): SeatLine[] {
  const lines: SeatLine[] = [];
  const byTicketType = new Map<number, SeatLine>();
  for (const seat of seats) {
    if (!isPricedSeat(seat)) continue;
    const line = byTicketType.get(seat.ticket_type_id);
    if (line) {
      line.seat_ids.push(seat.seat_id);
      line.seats.push(seat);
      continue;
    }
    const created: SeatLine = {
      ticket_type_id: seat.ticket_type_id,
      name: seat.ticket_type_name,
      price: seat.price,
      seat_ids: [seat.seat_id],
      seats: [seat],
    };
    byTicketType.set(seat.ticket_type_id, created);
    lines.push(created);
  }
  return lines;
}
