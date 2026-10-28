import type { CreateOrderBody, CreateOrderTicket } from '@/types/api';
import type { SeatHoldPayload } from '@/types/seating';

import { groupIntoLines } from './selection';

export type SeatedOrderExtras = Omit<CreateOrderBody, 'tickets' | 'seat_hold_token'>;

export function buildSeatedOrderBody(hold: SeatHoldPayload, extras: SeatedOrderExtras = {}): CreateOrderBody {
  const tickets: CreateOrderTicket[] = groupIntoLines(hold.seats).map((line) => ({
    ticket_type_id: line.ticket_type_id,
    quantity: line.seat_ids.length,
    seat_ids: line.seat_ids,
  }));
  return { ...extras, tickets, seat_hold_token: hold.hold_token };
}
