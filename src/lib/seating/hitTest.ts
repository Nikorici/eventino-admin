import type { CanvasPoint } from '@/types/seating';

import { gridCellCoordinate, gridCellKey, type IndexedSeat, type SeatIndex, type SectionBounds } from './seatIndex';

export interface Point {
  x: number;
  y: number;
}

export const MIN_HIT_RADIUS_PT = 22;

export function hitRadiusForScale(seatRadius: number, scale: number): number {
  return Math.max(seatRadius, MIN_HIT_RADIUS_PT / scale);
}

export function hitTestSeat(point: Point, index: SeatIndex, radius: number): IndexedSeat | null {
  const { grid, seatsById } = index;
  const span = Math.max(1, Math.ceil(radius / grid.cellSize));
  const centerX = gridCellCoordinate(point.x, grid.cellSize);
  const centerY = gridCellCoordinate(point.y, grid.cellSize);
  const limit = radius * radius;
  let best: IndexedSeat | null = null;
  let bestDistance = Infinity;

  for (let dx = -span; dx <= span; dx += 1) {
    for (let dy = -span; dy <= span; dy += 1) {
      const ids = grid.cells.get(gridCellKey(centerX + dx, centerY + dy));
      if (!ids) continue;
      for (const id of ids) {
        const seat = seatsById.get(id);
        if (!seat) continue;
        const distance = (seat.x - point.x) ** 2 + (seat.y - point.y) ** 2;
        if (distance > limit || distance >= bestDistance) continue;
        best = seat;
        bestDistance = distance;
      }
    }
  }

  return best;
}

export function pointInPolygon(point: Point, polygon: CanvasPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > point.y !== yj > point.y;
    if (!crosses) continue;
    const intersectX = ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (point.x < intersectX) inside = !inside;
  }
  return inside;
}

function boundsContain(bounds: SectionBounds, point: Point): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

export function hitTestSection(point: Point, sections: SectionBounds[]): SectionBounds | null {
  let best: SectionBounds | null = null;
  for (const section of sections) {
    if (!boundsContain(section, point)) continue;
    if (section.outline.length >= 3 && !pointInPolygon(point, section.outline)) continue;
    if (best === null || section.area < best.area) best = section;
  }
  return best;
}
