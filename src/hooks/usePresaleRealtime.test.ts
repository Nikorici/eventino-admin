import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import RNEventSource, { type EventSourceEvent, type EventSourceListener, type MessageEvent } from 'react-native-sse';

import { presaleBackoffMs, usePresaleRealtime } from './usePresaleRealtime';

const mockFetchToken = jest.fn();

jest.mock('@/store/api/presaleApi', () => ({
  presaleEndpoints: {
    stream: (eventId: number, token: string) => `/api/v1/presale/events/${eventId}/organizer/stream/?token=${token}`,
  },
  useLazyGetPresaleStreamTokenQuery: () => [mockFetchToken],
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
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener));
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

function message(data: string): MessageEvent {
  return { type: 'message', data, lastEventId: null, url: '' };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePresaleRealtime', () => {
  const onMessage = jest.fn();
  const onResync = jest.fn();
  let issued = 0;

  beforeEach(() => {
    jest.useFakeTimers();
    MockedEventSource.mockReset();
    MockedEventSource.mockImplementation(() => new FakeEventSource() as unknown as RNEventSource);
    issued = 0;
    mockFetchToken.mockReset();
    mockFetchToken.mockImplementation(() => {
      issued += 1;
      return { unwrap: () => Promise.resolve({ stream_token: `tok${issued}`, expires_in: 300 }) };
    });
    onMessage.mockClear();
    onResync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function render() {
    return renderHook(() => usePresaleRealtime({ eventId: 9, enabled: true, onMessage, onResync }));
  }

  it('opens the stream with a token and forwards parsed messages', async () => {
    const { result } = await render();
    await flush();
    expect(MockedEventSource).toHaveBeenCalledWith(expect.stringContaining('/api/v1/presale/events/9/organizer/stream/?token=tok1'), {
      pollingInterval: 0,
    });
    const source = sourceAt(0);
    await act(() => source.dispatch('open', { type: 'open' }));
    expect(result.current).toBe('live');
    await act(() => source.dispatch('message', message('{"type":"notifications"}')));
    await act(() => source.dispatch('message', message('not json')));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: 'notifications' });
    expect(onResync).not.toHaveBeenCalled();
  });

  it('reconnects after an error with a new token and resyncs on reopen', async () => {
    const { result } = await render();
    await flush();
    const first = sourceAt(0);
    await act(() => first.dispatch('open', { type: 'open' }));
    await act(() => first.dispatch('error', { type: 'error', message: 'down', xhrState: 4, xhrStatus: 502 }));
    expect(first.close).toHaveBeenCalled();
    expect(result.current).toBe('reconnecting');
    await act(async () => {
      jest.advanceTimersByTime(presaleBackoffMs(1));
    });
    await flush();
    expect(MockedEventSource).toHaveBeenLastCalledWith(expect.stringContaining('token=tok2'), { pollingInterval: 0 });
    await act(() => sourceAt(1).dispatch('open', { type: 'open' }));
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('retries when the stream token cannot be fetched', async () => {
    mockFetchToken.mockImplementationOnce(() => ({ unwrap: () => Promise.reject(new Error('403')) }));
    await render();
    await flush();
    expect(MockedEventSource).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(presaleBackoffMs(1));
    });
    await flush();
    expect(MockedEventSource).toHaveBeenCalledTimes(1);
  });

  describe('app state', () => {
    let changeHandler: (state: AppStateStatus) => void = () => undefined;

    beforeEach(() => {
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
        changeHandler = handler;
        return { remove: jest.fn() };
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function holdNextToken() {
      let release: () => void = () => undefined;
      mockFetchToken.mockImplementationOnce(() => ({
        unwrap: () =>
          new Promise((resolve) => {
            release = () => resolve({ stream_token: 'held', expires_in: 300 });
          }),
      }));
      return () => release();
    }

    it('does not open a stream when backgrounded while the token is pending', async () => {
      const release = holdNextToken();
      await render();
      await flush();
      await act(() => changeHandler('background'));
      release();
      await flush();
      expect(MockedEventSource).not.toHaveBeenCalled();
    });

    it('does not open a second stream when active fires while the token is pending', async () => {
      const release = holdNextToken();
      await render();
      await flush();
      await act(() => changeHandler('active'));
      await flush();
      release();
      await flush();
      expect(MockedEventSource).toHaveBeenCalledTimes(1);
      expect(MockedEventSource).toHaveBeenCalledWith(expect.stringContaining('token=tok1'), { pollingInterval: 0 });
    });

    it('reconnects with a fresh token after background then active and resyncs', async () => {
      await render();
      await flush();
      await act(() => sourceAt(0).dispatch('open', { type: 'open' }));
      const first = sourceAt(0);
      await act(() => changeHandler('background'));
      expect(first.close).toHaveBeenCalled();
      await act(() => changeHandler('active'));
      await flush();
      expect(MockedEventSource).toHaveBeenCalledTimes(2);
      expect(MockedEventSource).toHaveBeenLastCalledWith(expect.stringContaining('token=tok2'), { pollingInterval: 0 });
      await act(() => sourceAt(1).dispatch('open', { type: 'open' }));
      expect(onResync).toHaveBeenCalledTimes(1);
    });
  });

  it('resyncs when the stream reopens after focus is lost and regained', async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => usePresaleRealtime({ eventId: 9, enabled, onMessage, onResync }),
      { initialProps: { enabled: true } },
    );
    await flush();
    const first = sourceAt(0);
    await act(() => first.dispatch('open', { type: 'open' }));
    expect(result.current).toBe('live');
    expect(onResync).not.toHaveBeenCalled();
    await rerender({ enabled: false });
    expect(first.close).toHaveBeenCalled();
    expect(result.current).toBe('connecting');
    await rerender({ enabled: true });
    await flush();
    await act(() => sourceAt(1).dispatch('open', { type: 'open' }));
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('closes the stream on unmount', async () => {
    const { unmount } = await render();
    await flush();
    const source = sourceAt(0);
    await unmount();
    expect(source.close).toHaveBeenCalled();
  });

  it('caps the backoff at 30 seconds', () => {
    expect(presaleBackoffMs(1)).toBe(1000);
    expect(presaleBackoffMs(3)).toBe(4000);
    expect(presaleBackoffMs(20)).toBe(30000);
  });
});
