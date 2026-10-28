import { eventDaysBetween, pinnedEventDay, sharedEventDay } from './ticketDays';

describe('eventDaysBetween', () => {
  it('lists every day of a multi-day event inclusively', () => {
    expect(eventDaysBetween('2026-10-22', '2026-10-24')).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
  });

  it('is empty for single-day, reversed, missing, or invalid dates', () => {
    expect(eventDaysBetween('2026-10-22', '2026-10-22')).toEqual([]);
    expect(eventDaysBetween('2026-10-24', '2026-10-22')).toEqual([]);
    expect(eventDaysBetween('', '2026-10-22')).toEqual([]);
    expect(eventDaysBetween('2026-10-22', null)).toEqual([]);
    expect(eventDaysBetween('nope', '2026-10-22')).toEqual([]);
  });

  it('gives up on events longer than 62 days', () => {
    expect(eventDaysBetween('2026-01-01', '2026-03-03')).toHaveLength(62);
    expect(eventDaysBetween('2026-01-01', '2026-03-04')).toEqual([]);
  });
});

describe('pinnedEventDay', () => {
  const days = ['2026-10-22', '2026-10-23'];

  it('keeps only a day that falls inside the event', () => {
    expect(pinnedEventDay('2026-10-23', days)).toBe('2026-10-23');
    expect(pinnedEventDay('2026-10-25', days)).toBeNull();
    expect(pinnedEventDay('', days)).toBeNull();
    expect(pinnedEventDay(null, [])).toBeNull();
  });
});

describe('sharedEventDay', () => {
  it('returns the day only when every ticket in the order is pinned to it', () => {
    expect(sharedEventDay([{ ticket_type: { event_day: '2026-10-23' } }, { ticket_type: { event_day: '2026-10-23' } }])).toBe('2026-10-23');
    expect(sharedEventDay([{ ticket_type: { event_day: '2026-10-23' } }, { ticket_type: { event_day: null } }])).toBeNull();
    expect(sharedEventDay([{ ticket_type: {} }])).toBeNull();
    expect(sharedEventDay([])).toBeNull();
  });
});
