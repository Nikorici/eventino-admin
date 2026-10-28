import { applyStatusDeltas, deriveRenderStatus, isSelectableStatus, replaceStatuses, seatStatusOf, statusMapFromBuckets } from './status';
import { fixtureSeatMap } from './testFixtures';

describe('seat statuses', () => {
  it('builds a map of non-available seats from buckets', () => {
    const map = statusMapFromBuckets(fixtureSeatMap.statuses);
    expect(map.size).toBe(2);
    expect(seatStatusOf(map, 102)).toBe('sold');
    expect(seatStatusOf(map, 301)).toBe('unavailable');
    expect(seatStatusOf(map, 101)).toBe('available');
  });

  it('applies deltas in place and reports changes', () => {
    const map = statusMapFromBuckets(fixtureSeatMap.statuses);
    expect(applyStatusDeltas(map, [{ seat_id: 101, status: 'reserved' }])).toBe(true);
    expect(seatStatusOf(map, 101)).toBe('reserved');
    expect(applyStatusDeltas(map, [{ seat_id: 101, status: 'reserved' }])).toBe(false);
    expect(applyStatusDeltas(map, [{ seat_id: 101, status: 'available' }])).toBe(true);
    expect(map.has(101)).toBe(false);
    expect(applyStatusDeltas(map, [{ seat_id: 101, status: 'available' }])).toBe(false);
  });

  it('replaces all statuses with a fresh snapshot', () => {
    const map = statusMapFromBuckets(fixtureSeatMap.statuses);
    replaceStatuses(map, { sold: [], reserved: [105], blocked: [104], disabled: [], unavailable: [] });
    expect(map.has(102)).toBe(false);
    expect(seatStatusOf(map, 105)).toBe('reserved');
    expect(seatStatusOf(map, 104)).toBe('blocked');
  });

  it('derives render statuses with selection precedence', () => {
    const map = statusMapFromBuckets({ sold: [], reserved: [101], blocked: [], disabled: [], unavailable: [] });
    expect(deriveRenderStatus(map, 101, true, true)).toBe('selected');
    expect(deriveRenderStatus(map, 101, false, true)).toBe('reserved');
    expect(deriveRenderStatus(map, 105, false, false)).toBe('unavailable');
    expect(deriveRenderStatus(map, 105, false, true)).toBe('available');
    expect(isSelectableStatus('available')).toBe(true);
    expect(isSelectableStatus('selected')).toBe(true);
    expect(isSelectableStatus('sold')).toBe(false);
  });
});
