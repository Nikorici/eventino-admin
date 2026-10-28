import { formatCountdown, isExpired, remainingSeconds, serverOffsetMs } from './countdown';

const clientNow = Date.parse('2026-09-04T09:59:30Z');

describe('countdown', () => {
  it('measures the server clock offset', () => {
    expect(serverOffsetMs('2026-09-04T10:00:00Z', clientNow)).toBe(30000);
    expect(serverOffsetMs('not a date', clientNow)).toBe(0);
  });

  it('counts remaining seconds using the server offset', () => {
    expect(remainingSeconds('2026-09-04T10:10:00Z', 30000, clientNow)).toBe(600);
    expect(remainingSeconds('2026-09-04T10:10:00Z', 0, clientNow)).toBe(630);
    expect(remainingSeconds('2026-09-04T09:00:00Z', 30000, clientNow)).toBe(0);
    expect(remainingSeconds('garbage', 0, clientNow)).toBe(0);
  });

  it('reports expiry', () => {
    expect(isExpired('2026-09-04T10:00:00Z', 30000, clientNow)).toBe(true);
    expect(isExpired('2026-09-04T10:00:01Z', 30000, clientNow)).toBe(false);
  });

  it('formats mm:ss', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-4)).toBe('0:00');
  });
});
