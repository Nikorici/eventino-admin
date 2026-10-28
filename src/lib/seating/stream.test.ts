import { DedupeWindow, parseSeatMapStreamEvent } from './stream';

describe('parseSeatMapStreamEvent', () => {
  it('parses seat status events', () => {
    const raw = JSON.stringify({
      type: 'SEAT_STATUS',
      dedupe_id: 'abc',
      event_id: 5,
      server_time: '2026-09-04T10:00:00Z',
      changes: [
        { seat_id: 1, status: 'reserved' },
        { seat_id: 2, status: 'available' },
      ],
    });
    expect(parseSeatMapStreamEvent(raw)).toEqual({
      type: 'SEAT_STATUS',
      dedupe_id: 'abc',
      event_id: 5,
      server_time: '2026-09-04T10:00:00Z',
      changes: [
        { seat_id: 1, status: 'reserved' },
        { seat_id: 2, status: 'available' },
      ],
    });
  });

  it('parses config events', () => {
    expect(parseSeatMapStreamEvent(JSON.stringify({ type: 'SEAT_MAP_CONFIG', dedupe_id: 'x', event_id: 5, config_version: 4 }))).toEqual({
      type: 'SEAT_MAP_CONFIG',
      dedupe_id: 'x',
      event_id: 5,
      config_version: 4,
    });
  });

  it('rejects malformed payloads', () => {
    expect(parseSeatMapStreamEvent('{')).toBeNull();
    expect(parseSeatMapStreamEvent('"text"')).toBeNull();
    expect(parseSeatMapStreamEvent(JSON.stringify({ type: 'OTHER', dedupe_id: 'x', event_id: 5 }))).toBeNull();
    expect(parseSeatMapStreamEvent(JSON.stringify({ type: 'SEAT_STATUS', dedupe_id: 'x', event_id: 5, changes: [{ seat_id: 1, status: 'weird' }] }))).toBeNull();
    expect(parseSeatMapStreamEvent(JSON.stringify({ type: 'SEAT_MAP_CONFIG', dedupe_id: 'x', event_id: 5 }))).toBeNull();
    expect(parseSeatMapStreamEvent(JSON.stringify({ type: 'SEAT_STATUS', event_id: 5, changes: [] }))).toBeNull();
  });
});

describe('DedupeWindow', () => {
  it('remembers keys once and evicts the oldest', () => {
    const window = new DedupeWindow(2);
    expect(window.remember('a')).toBe(true);
    expect(window.remember('a')).toBe(false);
    expect(window.remember('b')).toBe(true);
    expect(window.remember('c')).toBe(true);
    expect(window.remember('a')).toBe(true);
  });
});
