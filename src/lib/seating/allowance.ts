import { SINGLE_TICKET_EVENT_IDS } from '@/lib/constants';

export interface SeatAllowanceInput {
  eventId: number;
  maxTicketsPerUser: number | null | undefined;
  hasBought: boolean;
}

export function remainingTicketAllowance({ eventId, maxTicketsPerUser, hasBought }: SeatAllowanceInput): number | null {
  const isSingleTicketEvent = SINGLE_TICKET_EVENT_IDS.includes(eventId) || maxTicketsPerUser === 1;
  if (isSingleTicketEvent && hasBought) return 0;
  if (maxTicketsPerUser != null && maxTicketsPerUser > 0) return maxTicketsPerUser;
  return isSingleTicketEvent ? 1 : null;
}

export function seatSelectionLimit(maxSeatsPerOrder: number, input: SeatAllowanceInput): number {
  const allowance = remainingTicketAllowance(input);
  const limit = allowance == null ? maxSeatsPerOrder : Math.min(maxSeatsPerOrder, allowance);
  return Math.max(0, limit);
}
