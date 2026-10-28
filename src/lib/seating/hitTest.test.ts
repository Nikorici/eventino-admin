import { hitRadiusForScale, hitTestSeat, hitTestSection, pointInPolygon } from './hitTest';
import { buildSeatIndexFromResponse } from './seatIndex';
import { fixtureSeatMap } from './testFixtures';

describe('hitTest', () => {
  const index = buildSeatIndexFromResponse(fixtureSeatMap);

  it('grows the hit radius when zoomed out', () => {
    expect(hitRadiusForScale(13, 0.5)).toBe(44);
    expect(hitRadiusForScale(13, 4)).toBe(13);
  });

  it('returns the nearest seat within the radius', () => {
    expect(hitTestSeat({ x: 95, y: 52 }, index, 13)?.id).toBe(102);
    expect(hitTestSeat({ x: 70, y: 50 }, index, 25)?.id).toBe(101);
  });

  it('finds seats in neighbouring grid cells', () => {
    expect(hitTestSeat({ x: 79, y: 50 }, index, 13)?.id).toBe(102);
    expect(hitTestSeat({ x: 81, y: 50 }, index, 40)?.id).toBe(102);
  });

  it('returns null when nothing is within the radius', () => {
    expect(hitTestSeat({ x: 300, y: 300 }, index, 13)).toBeNull();
    expect(hitTestSeat({ x: 70, y: 50 }, index, 10)).toBeNull();
  });

  it('tests points against polygons', () => {
    const square: [number, number][] = [
      [0, 0],
      [400, 0],
      [400, 200],
      [0, 200],
    ];
    expect(pointInPolygon({ x: 200, y: 100 }, square)).toBe(true);
    expect(pointInPolygon({ x: 500, y: 100 }, square)).toBe(false);
  });

  it('picks the smallest section containing the point', () => {
    expect(hitTestSection({ x: 200, y: 100 }, index.sectionBounds)?.sectionId).toBe(2);
    expect(hitTestSection({ x: 20, y: 20 }, index.sectionBounds)?.sectionId).toBe(1);
    expect(hitTestSection({ x: 600, y: 600 }, index.sectionBounds)?.sectionId).toBe(3);
    expect(hitTestSection({ x: 700, y: 700 }, index.sectionBounds)).toBeNull();
  });
});
