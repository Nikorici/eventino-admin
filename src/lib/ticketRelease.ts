import type { ArenaVenue, ArenaZone } from '@/types/api';

export interface ReleaseAttendeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ReleaseRowInput {
  ticketTypeId: number;
  quantity: number;
  zoneId?: number | null;
  seatIds?: number[];
}

export interface ReleasePayload {
  firstName: string;
  lastName: string;
  email: string;
  ticketTypeId: number;
  quantity: number;
  phone?: string;
  zoneId?: number;
  seat_ids?: number[];
}

export function validatePhone(phone: string): boolean {
  if (!/^[0-9+()\-.\s]+$/.test(phone)) return false;
  if ((phone.match(/\+/g) ?? []).length > 1) return false;
  if (phone.includes('+') && !phone.startsWith('+')) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

export function liveTicketTypes<T extends { id: number }>(
  ticketTypes: T[],
  eventTicketTypes: { id: number; is_active?: boolean }[] | undefined,
): T[] {
  const liveIds = new Set((eventTicketTypes ?? []).filter((type) => type.is_active === true).map((type) => type.id));
  return ticketTypes.filter((type) => liveIds.has(type.id));
}

export function zonesForTicketType(venues: ArenaVenue[] | undefined, ticketTypeId: number): ArenaZone[] {
  return (venues ?? [])
    .flatMap((venue) => venue.zones ?? [])
    .filter((zone) => zone.is_active !== false && zone.ticket_type_id === ticketTypeId);
}

export function buildReleasePayload(attendee: ReleaseAttendeeInput, row: ReleaseRowInput, seated: boolean): ReleasePayload {
  const phone = (attendee.phone ?? '').trim();
  const payload: ReleasePayload = {
    firstName: attendee.firstName,
    lastName: attendee.lastName,
    email: attendee.email,
    ticketTypeId: row.ticketTypeId,
    quantity: row.quantity,
  };
  if (phone) payload.phone = phone;
  if (seated) {
    payload.seat_ids = (row.seatIds ?? []).map(Number).filter(Number.isFinite);
  } else if (row.zoneId != null) {
    payload.zoneId = row.zoneId;
  }
  return payload;
}

export function releaseRowSeatError(row: ReleaseRowInput, seated: boolean): { expected: number; picked: number } | null {
  if (!seated) return null;
  const quantity = Number(row.quantity) || 0;
  const picked = row.seatIds?.length ?? 0;
  if (picked === quantity) return null;
  return { expected: quantity, picked };
}
