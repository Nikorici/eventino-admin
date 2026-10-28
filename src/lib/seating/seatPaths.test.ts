import { buildSeatIndexFromResponse } from './seatIndex';
import { buildSectionSeatPaths, seatCirclePath, type SeatPalette } from './seatPaths';
import { categoriesById } from './selection';
import { statusMapFromBuckets } from './status';
import { fixtureSeatMap } from './testFixtures';

const palette: SeatPalette = { selected: '#sel', reserved: '#res', sold: '#sold', unavailable: '#una' };

describe('seatCirclePath', () => {
  it('draws a closed circle from two arcs', () => {
    expect(seatCirclePath(10, 20, 5)).toBe('M15 20a5 5 0 1 0 -10 0a5 5 0 1 0 10 0');
  });
});

describe('buildSectionSeatPaths', () => {
  const index = buildSeatIndexFromResponse(fixtureSeatMap);
  const categories = categoriesById(fixtureSeatMap.categories);
  const statuses = statusMapFromBuckets(fixtureSeatMap.statuses);

  it('groups seats into one path per category and status, selected painted last', () => {
    const parterSeats = index.seats.filter((seat) => seat.sectionId === 1);
    const result = buildSectionSeatPaths(parterSeats, statuses, new Set([104]), categories, 13, palette);
    expect(result.groups.map((group) => group.key)).toEqual(['category:7', 'sold', 'category:9', 'selected']);
    const parter = result.groups.find((group) => group.key === 'category:7');
    expect(parter?.fill).toBe('#02acf7');
    expect(parter?.d.split('M')).toHaveLength(3);
    expect(result.groups.find((group) => group.key === 'sold')?.d).toContain('M103 50');
    expect(result.selectedRing).toBe(seatCirclePath(50, 90, 16));
  });

  it('paints seats without a sellable category as unavailable', () => {
    const lojaSeats = index.seats.filter((seat) => seat.sectionId === 3);
    const result = buildSectionSeatPaths(lojaSeats, statuses, new Set(), categories, 13, palette);
    expect(result.groups).toEqual([{ key: 'unavailable', fill: '#una', d: seatCirclePath(600, 600, 13) }]);
    expect(result.selectedRing).toBe('');
  });
});
