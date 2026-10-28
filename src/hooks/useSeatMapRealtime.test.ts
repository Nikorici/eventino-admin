import { act, renderHook } from '@testing-library/react-native';
import RNEventSource, { type EventSourceEvent, type EventSourceListener, type MessageEvent } from 'react-native-sse';

import { REALTIME_LIBRARY_RECONNECT_MS, REALTIME_POLL_INTERVAL_MS, backoffDelayMs, useSeatMapRealtime } from './useSeatMapRealtime';

const mockFetchStatuses = jest.fn();

jest.mock('@/store/api/seatingApi', () => ({
  useLazyGetSeatStatusesQuery: () => [mockFetchStatuses],
}));

class FakeEventSource {
  private readonly listeners = new Map<string, unknown[]>();
  readonly close = jest.fn();
  readonly open = jest.fn();

  addEventListener<T extends string>(type: T, listener: EventSourceListener<string, T>): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener<T extends string>(type: T, listener: EventSourceListener<string, T>): void {
    const bucket = (this.listeners.get(type) ?? []).filter((item) => item !== listener);
    this.listeners.set(type, bucket);
  }

  removeAllEventListeners<T extends string>(type?: T): void {
    if (type) this.listeners.delete(type);
    else this.listeners.clear();
  }

  dispatch<T extends string>(type: T, data: EventSourceEvent<T>): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(data);
    }
  }
}

const MockedEventSource = jest.mocked(RNEventSource);

function sourceAt(index: number): FakeEventSource {
  const created = MockedEventSource.mock.results[index]?.value;
  if (!(created instanceof FakeEventSource)) throw new Error(`no event source at ${index}`);
  return created;
}

const snapshot = {
  server_time: '2026-09-04T10:00:00Z',
  config_version: 3,
  available_seats: 10,
  statuses: { sold: [1], reserved: [], blocked: [], disabled: [], unavailable: [] },
};

function statusMessage(dedupeId: string): MessageEvent {
  return {
    type: 'message',
    data: JSON.stringify({
      type: 'SEAT_STATUS',
      dedupe_id: dedupeId,
      event_id: 5,
      server_time: '2026-09-04T10:00:00Z',
      changes: [{ seat_id: 7, status: 'reserved' }],
    }),
    lastEventId: null,
    url: '',
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useSeatMapRealtime', () => {
  const onSeatStatus = jest.fn();
  const onStatusSnapshot = jest.fn();
  const onConfigVersion = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    MockedEventSource.mockReset();
    MockedEventSource.mockImplementation(() => new FakeEventSource());
    mockFetchStatuses.mockReset();
    mockFetchStatuses.mockImplementation(() => ({ unwrap: () => Promise.resolve(snapshot) }));
    onSeatStatus.mockClear();
    onStatusSnapshot.mockClear();
    onConfigVersion.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function render(configVersion: number | null = 3) {
    return renderHook(() =>
      useSeatMapRealtime({ eventId: 5, enabled: true, configVersion, onSeatStatus, onStatusSnapshot, onConfigVersion }),
    );
  }

  it('opens the stream without polling and forwards status events once', () => {
    render();
    expect(MockedEventSource).toHaveBeenCalledTimes(1);
    expect(MockedEventSource).toHaveBeenCalledWith(expect.stringContaining('/api/v1/events/5/seats/stream/'), {
      pollingInterval: REALTIME_LIBRARY_RECONNECT_MS,
    });
    const source = sourceAt(0);
    act(() => source.dispatch('open', { type: 'open' }));
    expect(mockFetchStatuses).not.toHaveBeenCalled();
    act(() => source.dispatch('message', statusMessage('d1')));
    act(() => source.dispatch('message', statusMessage('d1')));
    expect(onSeatStatus).toHaveBeenCalledTimes(1);
    expect(onSeatStatus).toHaveBeenCalledWith(expect.objectContaining({ type: 'SEAT_STATUS', changes: [{ seat_id: 7, status: 'reserved' }] }));
  });

  it('resyncs when the library reopens the same stream after a clean server end', async () => {
    render();
    const source = sourceAt(0);
    act(() => source.dispatch('open', { type: 'open' }));
    expect(mockFetchStatuses).not.toHaveBeenCalled();
    act(() => source.dispatch('open', { type: 'open' }));
    await flush();
    expect(mockFetchStatuses).toHaveBeenCalledTimes(1);
    expect(onStatusSnapshot).toHaveBeenCalledWith(snapshot);
    expect(MockedEventSource).toHaveBeenCalledTimes(1);
  });

  it('closes a failed source again on the next tick so the library cannot reopen it', () => {
    render();
    const first = sourceAt(0);
    act(() => first.dispatch('error', { type: 'error', message: 'down', xhrState: 4, xhrStatus: 503 }));
    expect(first.close).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(0));
    expect(first.close).toHaveBeenCalledTimes(2);
  });

  it('reconnects with backoff after an error and resyncs statuses on the next open', async () => {
    render(2);
    const first = sourceAt(0);
    act(() => first.dispatch('open', { type: 'open' }));
    act(() => first.dispatch('error', { type: 'error', message: 'down', xhrState: 4, xhrStatus: 0 }));
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(MockedEventSource).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(backoffDelayMs(1)));
    expect(MockedEventSource).toHaveBeenCalledTimes(2);
    const second = sourceAt(1);
    act(() => second.dispatch('open', { type: 'open' }));
    await flush();
    expect(mockFetchStatuses).toHaveBeenCalledTimes(1);
    expect(mockFetchStatuses).toHaveBeenCalledWith(5);
    expect(onStatusSnapshot).toHaveBeenCalledWith(snapshot);
    expect(onConfigVersion).toHaveBeenCalledWith(3);
  });

  it('falls back to polling after three failed opens and stops on open', async () => {
    render();
    const fail = (index: number) => {
      act(() => sourceAt(index).dispatch('error', { type: 'error', message: 'down', xhrState: 4, xhrStatus: 0 }));
    };
    fail(0);
    act(() => jest.advanceTimersByTime(backoffDelayMs(1)));
    fail(1);
    act(() => jest.advanceTimersByTime(backoffDelayMs(2)));
    expect(mockFetchStatuses).not.toHaveBeenCalled();
    fail(2);
    await flush();
    expect(mockFetchStatuses).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(REALTIME_POLL_INTERVAL_MS));
    await flush();
    expect(mockFetchStatuses).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(backoffDelayMs(3)));
    const reconnected = sourceAt(3);
    act(() => reconnected.dispatch('open', { type: 'open' }));
    await flush();
    const callsAfterOpen = mockFetchStatuses.mock.calls.length;
    act(() => jest.advanceTimersByTime(REALTIME_POLL_INTERVAL_MS * 2));
    await flush();
    expect(mockFetchStatuses).toHaveBeenCalledTimes(callsAfterOpen);
  });

  it('closes the stream on unmount and does not reconnect', () => {
    const { unmount } = render();
    const source = sourceAt(0);
    unmount();
    expect(source.close).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(60000));
    expect(MockedEventSource).toHaveBeenCalledTimes(1);
  });

  it('does not connect while disabled', () => {
    renderHook(() =>
      useSeatMapRealtime({ eventId: 5, enabled: false, configVersion: 3, onSeatStatus, onStatusSnapshot, onConfigVersion }),
    );
    expect(MockedEventSource).not.toHaveBeenCalled();
  });
});
