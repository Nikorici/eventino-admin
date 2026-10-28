const MAX_PINNABLE_DAYS = 62;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(value: string): number | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function eventDaysBetween(startDate?: string | null, endDate?: string | null): string[] {
  if (!startDate || !endDate || endDate <= startDate) return [];
  const first = utcDay(startDate);
  const last = utcDay(endDate);
  if (first == null || last == null) return [];
  const count = Math.floor((last - first) / DAY_MS) + 1;
  if (count > MAX_PINNABLE_DAYS) return [];
  return Array.from({ length: count }, (_, index) => new Date(first + index * DAY_MS).toISOString().slice(0, 10));
}

export function pinnedEventDay(eventDay: string | null | undefined, pinnableDays: string[]): string | null {
  return eventDay && pinnableDays.includes(eventDay) ? eventDay : null;
}

export function sharedEventDay(tickets: { ticket_type?: { event_day?: string | null } }[]): string | null {
  const days = new Set(tickets.map((ticket) => ticket.ticket_type?.event_day ?? null));
  if (days.size !== 1) return null;
  return [...days][0];
}
