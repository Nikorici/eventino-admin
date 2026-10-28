import { formatStamp, matchesFilter, mergeRegistrations, parsePresaleStreamMessage, percentOf, refreshRegistrations, sourceLabel, sourceShares } from './presale';
import type { PresaleRegistrationRow } from '@/store/api/presaleApi';

const row = (id: number, extra: Partial<PresaleRegistrationRow> = {}) =>
  ({ id, email: `fan${id}@mail.test`, phone: `+3736000000${id}`, traffic_source: 'instagram', ...extra }) as PresaleRegistrationRow;
const t = (key: string) => `t:${key}`;

describe('presale helpers', () => {
  it('filters by email, phone and source', () => {
    expect(matchesFilter(row(1), { q: '', source: '' })).toBe(true);
    expect(matchesFilter(row(1), { q: 'FAN1', source: '' })).toBe(true);
    expect(matchesFilter(row(1), { q: '60000001', source: '' })).toBe(true);
    expect(matchesFilter(row(1), { q: 'nobody', source: '' })).toBe(false);
    expect(matchesFilter(row(1), { q: '', source: 'tiktok' })).toBe(false);
  });

  it('merges without duplicates, newest first', () => {
    expect(mergeRegistrations([row(5), row(3)], [row(5), row(7), row(4)]).map((item) => item.id)).toEqual([7, 5, 4, 3]);
    const current = [row(2)];
    expect(mergeRegistrations(current, [row(2)])).toBe(current);
  });

  it('never divides by zero', () => {
    expect(percentOf(3, 0)).toBe(0);
    expect(sourceShares({ total: 3, sources: [{ source: 'instagram', count: 2 }] } as never)).toEqual([
      { source: 'instagram', count: 2, percent: 67 },
    ]);
  });

  it('labels sources', () => {
    expect(sourceLabel('instagram', t)).toBe('Instagram');
    expect(sourceLabel('direct', t)).toBe('t:Direct');
    expect(sourceLabel('unknown', t)).toBe('t:Unknown');
    expect(sourceLabel('news.example.org', t)).toBe('news.example.org');
    expect(sourceLabel('__proto__', t)).toBe('__proto__');
    expect(sourceLabel('constructor', t)).toBe('constructor');
  });

  it('parses only known stream messages', () => {
    expect(parsePresaleStreamMessage('{"type":"notifications"}')).toEqual({ type: 'notifications' });
    expect(parsePresaleStreamMessage('{"type":"registration","registration":{"id":1},"summary":{"total":1}}')?.type).toBe('registration');
    expect(parsePresaleStreamMessage('{"type":"other"}')).toBeNull();
    expect(parsePresaleStreamMessage('not json')).toBeNull();
  });

  it('refreshes the first page without losing deeper rows', () => {
    const empty = refreshRegistrations([], null, { registrations: [row(9), row(8)], next_before: 8 });
    expect(empty.rows.map((item) => item.id)).toEqual([9, 8]);
    expect(empty.nextBefore).toBe(8);

    const replaced = refreshRegistrations([row(9, { notification_status: 'PENDING' } as never)], null, {
      registrations: [row(9, { notification_status: 'SENT' } as never)],
      next_before: null,
    });
    expect(replaced.rows).toHaveLength(1);
    expect((replaced.rows[0] as unknown as { notification_status: string }).notification_status).toBe('SENT');

    const deeper = refreshRegistrations([row(9), row(8), row(3), row(2)], 2, { registrations: [row(9), row(8)], next_before: 8 });
    expect(deeper.rows.map((item) => item.id)).toEqual([9, 8, 3, 2]);
    expect(deeper.nextBefore).toBe(2);

    const added = refreshRegistrations([row(9), row(8)], 8, { registrations: [row(11), row(10), row(9)], next_before: 9 });
    expect(added.rows.map((item) => item.id)).toEqual([11, 10, 9, 8]);
    expect(added.nextBefore).toBe(8);
  });
});

describe('formatStamp', () => {
  it('renders English dates day first', () => {
    expect(formatStamp('2026-10-04T12:00:00Z', 'en')).toContain('04/10/2026');
    expect(formatStamp('2026-10-04T12:00:00Z', '')).toContain('04/10/2026');
  });
});
