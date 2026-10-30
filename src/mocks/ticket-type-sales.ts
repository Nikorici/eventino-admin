import type { TicketTypeSalesResponse } from '@/store/api/organizerApi';

import { findMockEvent } from './core';
import { bodyOf, mock, type MockHandler } from './mock';

export const handlers: MockHandler[] = [
  mock('POST', '/api/v1/statistics/get-ticket-type-sales/', (request): TicketTypeSalesResponse => {
    const event = findMockEvent(Number(bodyOf<{ event_id: number }>(request).event_id));
    if (!event) return { ticket_types: [] };
    return {
      ticket_types: event.ticketTypes.map((ticketType) => ({
        id: ticketType.id,
        name: ticketType.name,
        price: ticketType.price,
        currency: event.currency,
        total_quantity: ticketType.quantity,
        sold_quantity: ticketType.sold,
        sold_quantity_excluding_zero: ticketType.sold - Math.floor(ticketType.sold * 0.04),
        remaining_quantity: ticketType.quantity == null ? null : Math.max(0, ticketType.quantity - ticketType.sold),
      })),
    };
  }),
];
