import { buildSeatIndexFromResponse, gridCellKey, polygonArea, pointsBounds } from './seatIndex';
import { fixtureSeatMap } from './testFixtures';

describe('seatIndex', () => {
  const index = buildSeatIndexFromResponse(fixtureSeatMap);

  it('indexes every seat with its section and row', () => {
    expect(index.seats).toHaveLength(7);
    expect(index.seatsById.get(104)).toMatchObject({ sectionId: 1, sectionKey: 'parter', rowId: 11, rowLabel: '2', label: '1' });
    expect(index.canvas).toEqual({ width: 800, height: 800 });
    expect(index.seatRadius).toBe(13);
  });

  it('resolves seat categories with seat rules over section ticket types', () => {
    expect(index.seatsById.get(101)?.ticketTypeId).toBe(7);
    expect(index.seatsById.get(103)?.ticketTypeId).toBe(9);
    expect(index.seatsById.get(201)?.ticketTypeId).toBe(8);
    expect(index.seatsById.get(301)?.ticketTypeId).toBeNull();
  });

  it('builds section bounds from the outline', () => {
    const parter = index.sectionBounds.find((bounds) => bounds.sectionId === 1);
    expect(parter).toMatchObject({ minX: 0, minY: 0, maxX: 400, maxY: 200, area: 80000 });
  });

  it('places seats into 80-unit grid cells', () => {
    expect(index.grid.cellSize).toBe(80);
    expect(index.grid.cells.get(gridCellKey(0, 0))).toEqual([101]);
    expect(index.grid.cells.get(gridCellKey(1, 0))).toEqual([102, 103]);
    expect(index.grid.cells.get(gridCellKey(0, 1))).toEqual([104]);
    expect(index.grid.cells.get(gridCellKey(7, 7))).toEqual([301]);
  });

  it('computes polygon area and bounds', () => {
    expect(
      polygonArea([
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ]),
    ).toBe(8);
    expect(
      pointsBounds([
        [3, 9],
        [-1, 2],
      ]),
    ).toEqual({ minX: -1, minY: 2, maxX: 3, maxY: 9 });
  });
});
