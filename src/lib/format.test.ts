import { formatEventStartTime, formatEventTimeRange } from './format';
import { getEventTimeStatus } from './eventStatus';

describe('formatEventTimeRange', () => {
  it('returns the TBA label when the time is to be announced', () => {
    expect(formatEventTimeRange({ start_time: '00:00:00', end_time: null, time_is_tba: true }, 'Time TBA')).toBe('Time TBA');
  });

  it('formats start and end when both are known', () => {
    expect(formatEventTimeRange({ start_time: '19:00:00', end_time: '23:30:00' }, 'Time TBA')).toBe('19:00 - 23:30');
  });

  it('formats only the start when the end is missing', () => {
    expect(formatEventTimeRange({ start_time: '19:00:00', end_time: null }, 'Time TBA')).toBe('19:00');
  });

  it('returns an empty string without a start time', () => {
    expect(formatEventTimeRange({ start_time: null, end_time: null }, 'Time TBA')).toBe('');
  });
});

describe('formatEventStartTime', () => {
  it('hides the hour for TBA events', () => {
    expect(formatEventStartTime({ start_time: '00:00:00', time_is_tba: true })).toBe('');
    expect(formatEventStartTime({ start_time: '18:15:00' })).toBe('18:15');
  });
});

describe('getEventTimeStatus with a TBA time', () => {
  it('reports today instead of live on the event day', () => {
    const now = new Date(2030, 4, 1, 15, 0, 0);
    const status = getEventTimeStatus(
      { start_date: '2030-05-01', start_time: '00:00:00', end_date: '2030-05-01', end_time: null, time_is_tba: true },
      now,
    );
    expect(status).toBe('today');
  });
});
