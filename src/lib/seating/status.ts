import type { SeatRenderStatus, SeatStatus, SeatStatusBuckets, SeatStatusChange } from '@/types/seating';

export type SeatStatusMap = Map<number, SeatStatus>;

const BUCKET_ORDER: (keyof SeatStatusBuckets)[] = ['unavailable', 'disabled', 'blocked', 'reserved', 'sold'];

export function replaceStatuses(target: SeatStatusMap, buckets: SeatStatusBuckets): SeatStatusMap {
  target.clear();
  for (const status of BUCKET_ORDER) {
    for (const seatId of buckets[status] ?? []) target.set(seatId, status);
  }
  return target;
}

export function statusMapFromBuckets(buckets: SeatStatusBuckets): SeatStatusMap {
  return replaceStatuses(new Map(), buckets);
}

export function applyStatusDeltas(target: SeatStatusMap, changes: SeatStatusChange[]): boolean {
  let changed = false;
  for (const change of changes) {
    const current = target.get(change.seat_id);
    if (change.status === 'available') {
      if (current === undefined) continue;
      target.delete(change.seat_id);
      changed = true;
      continue;
    }
    if (current === change.status) continue;
    target.set(change.seat_id, change.status);
    changed = true;
  }
  return changed;
}

export function seatStatusOf(statuses: SeatStatusMap, seatId: number): SeatStatus {
  return statuses.get(seatId) ?? 'available';
}

export function deriveRenderStatus(
  statuses: SeatStatusMap,
  seatId: number,
  selected: boolean,
  sellable: boolean,
): SeatRenderStatus {
  if (selected) return 'selected';
  if (!sellable) return 'unavailable';
  return seatStatusOf(statuses, seatId);
}

export function isSelectableStatus(status: SeatRenderStatus): boolean {
  return status === 'available' || status === 'selected';
}
