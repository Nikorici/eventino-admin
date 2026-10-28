import type {
  CanvasPoint,
  CanvasSize,
  EventSeatMapResponse,
  LayoutSection,
  SeatMapSectionConfig,
  VenueLayoutDetail,
} from '@/types/seating';

export const GRID_CELL_SIZE = 80;

export interface IndexedSeat {
  id: number;
  label: string;
  x: number;
  y: number;
  sectionId: number;
  sectionKey: string;
  sectionName: string;
  rowId: number;
  rowLabel: string;
  ticketTypeId: number | null;
  isAccessible: boolean;
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SectionBounds extends Rect {
  sectionId: number;
  outline: CanvasPoint[];
  area: number;
}

export interface SpatialGrid {
  cellSize: number;
  cells: Map<string, number[]>;
}

export interface SeatIndex {
  canvas: CanvasSize;
  seatRadius: number;
  seats: IndexedSeat[];
  seatsById: Map<number, IndexedSeat>;
  sectionsById: Map<number, LayoutSection>;
  sectionBounds: SectionBounds[];
  grid: SpatialGrid;
}

export function gridCellCoordinate(value: number, cellSize: number): number {
  return Math.floor(value / cellSize);
}

export function gridCellKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}

export function buildSpatialGrid(seats: IndexedSeat[], cellSize = GRID_CELL_SIZE): SpatialGrid {
  const cells = new Map<string, number[]>();
  for (const seat of seats) {
    const key = gridCellKey(gridCellCoordinate(seat.x, cellSize), gridCellCoordinate(seat.y, cellSize));
    const bucket = cells.get(key);
    if (bucket) bucket.push(seat.id);
    else cells.set(key, [seat.id]);
  }
  return { cellSize, cells };
}

export function polygonArea(points: CanvasPoint[]): number {
  let doubled = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    doubled += x1 * y2 - x2 * y1;
  }
  return Math.abs(doubled) / 2;
}

export function pointsBounds(points: CanvasPoint[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function sectionTicketTypes(sections: SeatMapSectionConfig[]): Map<number, number | null> {
  const lookup = new Map<number, number | null>();
  for (const section of sections) {
    lookup.set(section.section_id, section.is_active ? section.ticket_type_id : null);
  }
  return lookup;
}

export function resolveSeatTicketType(
  seatId: number,
  sectionTicketTypeId: number | null,
  seatCategories: Record<string, number>,
): number | null {
  const override = seatCategories[String(seatId)];
  if (override != null) return override;
  return sectionTicketTypeId;
}

function sectionBoundsFor(section: LayoutSection, seats: IndexedSeat[], seatRadius: number): SectionBounds {
  if (section.outline.length >= 3) {
    return {
      sectionId: section.id,
      ...pointsBounds(section.outline),
      outline: section.outline,
      area: polygonArea(section.outline),
    };
  }
  const points: CanvasPoint[] = seats.map((seat) => [seat.x, seat.y]);
  const bounds = points.length > 0 ? pointsBounds(points) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const padded: Rect = {
    minX: bounds.minX - seatRadius,
    minY: bounds.minY - seatRadius,
    maxX: bounds.maxX + seatRadius,
    maxY: bounds.maxY + seatRadius,
  };
  return {
    sectionId: section.id,
    ...padded,
    outline: [],
    area: (padded.maxX - padded.minX) * (padded.maxY - padded.minY),
  };
}

export function buildSeatIndex(
  layout: VenueLayoutDetail,
  sections: SeatMapSectionConfig[],
  seatCategories: Record<string, number>,
): SeatIndex {
  const ticketTypesBySection = sectionTicketTypes(sections);
  const seats: IndexedSeat[] = [];
  const seatsById = new Map<number, IndexedSeat>();
  const sectionsById = new Map<number, LayoutSection>();
  const sectionBounds: SectionBounds[] = [];

  for (const section of layout.sections) {
    sectionsById.set(section.id, section);
    const sectionTicketTypeId = ticketTypesBySection.get(section.id) ?? null;
    const sectionSeats: IndexedSeat[] = [];
    for (const row of section.rows) {
      for (const seat of row.seats) {
        const indexed: IndexedSeat = {
          id: seat.id,
          label: seat.label,
          x: seat.x,
          y: seat.y,
          sectionId: section.id,
          sectionKey: section.key,
          sectionName: section.name,
          rowId: row.id,
          rowLabel: row.label,
          ticketTypeId: resolveSeatTicketType(seat.id, sectionTicketTypeId, seatCategories),
          isAccessible: seat.is_accessible,
        };
        sectionSeats.push(indexed);
        seats.push(indexed);
        seatsById.set(seat.id, indexed);
      }
    }
    sectionBounds.push(sectionBoundsFor(section, sectionSeats, layout.seat_radius));
  }

  return {
    canvas: layout.canvas,
    seatRadius: layout.seat_radius,
    seats,
    seatsById,
    sectionsById,
    sectionBounds,
    grid: buildSpatialGrid(seats),
  };
}

export function buildSeatIndexFromResponse(response: EventSeatMapResponse): SeatIndex {
  return buildSeatIndex(response.layout, response.sections, response.seat_categories);
}
