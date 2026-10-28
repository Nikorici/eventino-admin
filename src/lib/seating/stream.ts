import type { SeatMapStreamEvent, SeatStatus, SeatStatusChange } from '@/types/seating';

const SEAT_STATUSES: readonly SeatStatus[] = ['available', 'sold', 'reserved', 'blocked', 'disabled', 'unavailable'];

function isSeatStatus(value: unknown): value is SeatStatus {
  return typeof value === 'string' && SEAT_STATUSES.some((status) => status === value);
}

function readChanges(value: unknown): SeatStatusChange[] | null {
  if (!Array.isArray(value)) return null;
  const changes: SeatStatusChange[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    if (!('seat_id' in item) || typeof item.seat_id !== 'number') return null;
    if (!('status' in item) || !isSeatStatus(item.status)) return null;
    changes.push({ seat_id: item.seat_id, status: item.status });
  }
  return changes;
}

export function parseSeatMapStreamEvent(raw: string): SeatMapStreamEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('type' in payload) || !('dedupe_id' in payload) || typeof payload.dedupe_id !== 'string') return null;
  const eventId = 'event_id' in payload && typeof payload.event_id === 'number' ? payload.event_id : null;
  if (eventId === null) return null;

  if (payload.type === 'SEAT_STATUS') {
    const changes = 'changes' in payload ? readChanges(payload.changes) : null;
    if (!changes) return null;
    const serverTime = 'server_time' in payload && typeof payload.server_time === 'string' ? payload.server_time : '';
    return { type: 'SEAT_STATUS', dedupe_id: payload.dedupe_id, event_id: eventId, server_time: serverTime, changes };
  }

  if (payload.type === 'SEAT_MAP_CONFIG') {
    if (!('config_version' in payload) || typeof payload.config_version !== 'number') return null;
    return { type: 'SEAT_MAP_CONFIG', dedupe_id: payload.dedupe_id, event_id: eventId, config_version: payload.config_version };
  }

  return null;
}

export class DedupeWindow {
  private readonly seen = new Set<string>();

  constructor(private readonly limit: number) {}

  remember(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    while (this.seen.size > this.limit) {
      const oldest = this.seen.values().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
    return true;
  }
}
