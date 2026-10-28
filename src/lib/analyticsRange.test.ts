import { enUS } from 'date-fns/locale';

import { buildTimelineSlots, clampToLifecycle, parseBoundaryDate } from './analyticsRange';

describe('analytics lifecycle clamp', () => {
  it('parses date-only and datetime boundaries as local days', () => {
    expect(parseBoundaryDate('2026-09-05')).toEqual(new Date(2026, 8, 5));
    expect(parseBoundaryDate('2026-09-05T14:00:00Z')?.getHours()).toBe(0);
    expect(parseBoundaryDate(null)).toBeNull();
  });

  it('clamps a month window to the event lifecycle', () => {
    const range = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 30) };
    expect(clampToLifecycle(range, { start: new Date(2026, 8, 10), end: new Date(2026, 8, 20) })).toEqual({
      start: new Date(2026, 8, 10),
      end: new Date(2026, 8, 20),
    });
    expect(clampToLifecycle(range, null)).toEqual(range);
  });

  it('builds only the lifecycle days for month and week views', () => {
    const lifecycle = { start: new Date(2026, 8, 10), end: new Date(2026, 8, 12) };
    expect(buildTimelineSlots('month', new Date(2026, 8, 15), enUS, lifecycle).map((slot) => slot.key)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
    expect(buildTimelineSlots('day', new Date(2026, 8, 15), enUS, lifecycle)).toHaveLength(24);
  });
});
