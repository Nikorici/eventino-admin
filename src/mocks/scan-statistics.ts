import type { ScannedTicketsStatsResponse } from '@/store/api/organizerApi';

import { findMockEvent } from './core';
import { bodyOf, mock, type MockHandler } from './mock';

const SCAN_WEIGHTS = [0.95, 1.04, 1.27, 0.8];

export const handlers: MockHandler[] = [
  mock('POST', '/api/v1/statistics/get-scanned-tickets-stats/', (request): ScannedTicketsStatsResponse => {
    const event = findMockEvent(Number(bodyOf<{ event_id: number }>(request).event_id));
    if (!event) return { ticket_types: [] };
    const baseRate = event.ticketsSold > 0 ? event.ticketsScanned / event.ticketsSold : 0;
    return {
      ticket_types: event.ticketTypes.map((ticketType, index) => {
        const total = ticketType.sold;
        const scanned = Math.min(total, Math.round(total * baseRate * SCAN_WEIGHTS[index % SCAN_WEIGHTS.length]));
        return {
          id: ticketType.id,
          name: ticketType.name,
          total_tickets: total,
          scanned_tickets: scanned,
          unscanned_tickets: total - scanned,
          scan_percentage: total > 0 ? Math.round((scanned / total) * 10000) / 100 : 0,
        };
      }),
    };
  }),
];
