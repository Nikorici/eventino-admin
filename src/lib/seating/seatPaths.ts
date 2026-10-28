import type { SeatCategory } from '@/types/seating';

import type { IndexedSeat } from './seatIndex';
import { deriveRenderStatus, type SeatStatusMap } from './status';

export const SELECTED_RING_OFFSET = 3;

export interface SeatPalette {
  selected: string;
  reserved: string;
  sold: string;
  unavailable: string;
}

export interface SeatPathGroup {
  key: string;
  fill: string;
  d: string;
}

export interface SectionSeatPaths {
  groups: SeatPathGroup[];
  selectedRing: string;
}

export function seatCirclePath(x: number, y: number, radius: number): string {
  const diameter = radius * 2;
  return `M${x + radius} ${y}a${radius} ${radius} 0 1 0 ${-diameter} 0a${radius} ${radius} 0 1 0 ${diameter} 0`;
}

export function isSellableSeat(seat: IndexedSeat, categories: Map<number, SeatCategory>): boolean {
  return seat.ticketTypeId != null && categories.has(seat.ticketTypeId);
}

export function buildSectionSeatPaths(
  seats: IndexedSeat[],
  statuses: SeatStatusMap,
  selectedIds: Set<number>,
  categories: Map<number, SeatCategory>,
  seatRadius: number,
  palette: SeatPalette,
): SectionSeatPaths {
  const parts = new Map<string, { fill: string; segments: string[] }>();
  const ringSegments: string[] = [];

  const append = (key: string, fill: string, path: string) => {
    const bucket = parts.get(key);
    if (bucket) bucket.segments.push(path);
    else parts.set(key, { fill, segments: [path] });
  };

  for (const seat of seats) {
    const sellable = isSellableSeat(seat, categories);
    const status = deriveRenderStatus(statuses, seat.id, selectedIds.has(seat.id), sellable);
    const path = seatCirclePath(seat.x, seat.y, seatRadius);
    switch (status) {
      case 'selected':
        append('selected', palette.selected, path);
        ringSegments.push(seatCirclePath(seat.x, seat.y, seatRadius + SELECTED_RING_OFFSET));
        break;
      case 'available': {
        const category = seat.ticketTypeId == null ? undefined : categories.get(seat.ticketTypeId);
        append(`category:${seat.ticketTypeId}`, category?.color ?? palette.unavailable, path);
        break;
      }
      case 'reserved':
        append('reserved', palette.reserved, path);
        break;
      case 'sold':
        append('sold', palette.sold, path);
        break;
      default:
        append('unavailable', palette.unavailable, path);
    }
  }

  const groups: SeatPathGroup[] = [];
  let selected: SeatPathGroup | null = null;
  for (const [key, bucket] of parts) {
    const group = { key, fill: bucket.fill, d: bucket.segments.join('') };
    if (key === 'selected') selected = group;
    else groups.push(group);
  }
  if (selected) groups.push(selected);

  return { groups, selectedRing: ringSegments.join('') };
}
