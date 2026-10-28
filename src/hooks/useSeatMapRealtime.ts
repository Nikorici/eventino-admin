import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import RNEventSource, { type MessageEvent } from 'react-native-sse';

import { API_URL, USE_MOCKS, eventEndpoint } from '@/lib/constants';
import { DedupeWindow, parseSeatMapStreamEvent } from '@/lib/seating/stream';
import { useLazyGetSeatStatusesQuery } from '@/store/api/seatingApi';
import type { SeatStatusEvent, SeatStatusResponse } from '@/types/seating';

export const REALTIME_BACKOFF_MIN_MS = 1000;
export const REALTIME_BACKOFF_MAX_MS = 30000;
export const REALTIME_POLL_INTERVAL_MS = 15000;
export const REALTIME_POLL_AFTER_FAILURES = 3;
export const REALTIME_LIBRARY_RECONNECT_MS = 2000;
const DEDUPE_WINDOW_SIZE = 200;

export interface SeatMapRealtimeOptions {
  eventId: number | string | undefined;
  enabled: boolean;
  configVersion: number | null;
  onSeatStatus: (event: SeatStatusEvent) => void;
  onStatusSnapshot: (snapshot: SeatStatusResponse) => void;
  onConfigVersion: (configVersion: number) => void;
}

export interface SeatMapRealtime {
  resync: () => Promise<void>;
}

export function backoffDelayMs(failures: number): number {
  return Math.min(REALTIME_BACKOFF_MAX_MS, REALTIME_BACKOFF_MIN_MS * 2 ** Math.max(0, failures - 1));
}

export function useSeatMapRealtime({
  eventId,
  enabled,
  configVersion,
  onSeatStatus,
  onStatusSnapshot,
  onConfigVersion,
}: SeatMapRealtimeOptions): SeatMapRealtime {
  const [fetchStatuses] = useLazyGetSeatStatusesQuery();
  const callbacksRef = useRef({ onSeatStatus, onStatusSnapshot, onConfigVersion });
  const configVersionRef = useRef(configVersion);
  const hadConnectionRef = useRef(false);
  const dedupeRef = useRef(new DedupeWindow(DEDUPE_WINDOW_SIZE));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onSeatStatus, onStatusSnapshot, onConfigVersion };
  }, [onSeatStatus, onStatusSnapshot, onConfigVersion]);

  useEffect(() => {
    configVersionRef.current = configVersion;
  }, [configVersion]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const resync = useCallback(async () => {
    if (eventId == null) return;
    try {
      const snapshot = await fetchStatuses(eventId).unwrap();
      callbacksRef.current.onStatusSnapshot(snapshot);
      const known = configVersionRef.current;
      if (known != null && snapshot.config_version !== known) {
        callbacksRef.current.onConfigVersion(snapshot.config_version);
      }
    } catch {
      return;
    }
  }, [eventId, fetchStatuses]);

  useEffect(() => {
    if (USE_MOCKS || !enabled || !focused || eventId == null) return;

    const url = `${API_URL}${eventEndpoint.seatStream(eventId)}`;
    let closed = false;
    let source: RNEventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let failures = 0;

    const clearReconnect = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const startPolling = () => {
      if (pollTimer) return;
      void resync();
      pollTimer = setInterval(() => {
        void resync();
      }, REALTIME_POLL_INTERVAL_MS);
    };

    const cancelLibraryReconnect = (instance: RNEventSource) => {
      setTimeout(() => instance.close(), 0);
    };

    const closeSource = () => {
      const current = source;
      source = null;
      if (!current) return;
      current.removeAllEventListeners();
      current.close();
      cancelLibraryReconnect(current);
    };

    const scheduleReconnect = () => {
      if (closed) return;
      failures += 1;
      if (failures >= REALTIME_POLL_AFTER_FAILURES) startPolling();
      clearReconnect();
      reconnectTimer = setTimeout(connect, backoffDelayMs(failures));
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data == null) return;
      const parsed = parseSeatMapStreamEvent(event.data);
      if (!parsed || !dedupeRef.current.remember(parsed.dedupe_id)) return;
      if (parsed.type === 'SEAT_STATUS') {
        callbacksRef.current.onSeatStatus(parsed);
        return;
      }
      callbacksRef.current.onConfigVersion(parsed.config_version);
    };

    function connect() {
      if (closed) return;
      clearReconnect();
      closeSource();
      const next = new RNEventSource(url, { pollingInterval: REALTIME_LIBRARY_RECONNECT_MS });
      source = next;
      next.addEventListener('open', () => {
        if (closed || source !== next) return;
        failures = 0;
        stopPolling();
        if (hadConnectionRef.current) void resync();
        hadConnectionRef.current = true;
      });
      next.addEventListener('message', (event) => {
        if (closed || source !== next) return;
        handleMessage(event);
      });
      next.addEventListener('error', () => {
        if (closed || source !== next) return;
        closeSource();
        scheduleReconnect();
      });
      next.addEventListener('close', () => {
        if (closed || source !== next) return;
        closeSource();
        scheduleReconnect();
      });
    }

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        failures = 0;
        if (!source) connect();
        return;
      }
      clearReconnect();
      stopPolling();
      closeSource();
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') connect();

    return () => {
      closed = true;
      clearReconnect();
      stopPolling();
      subscription.remove();
      closeSource();
    };
  }, [enabled, focused, eventId, resync]);

  return { resync };
}
