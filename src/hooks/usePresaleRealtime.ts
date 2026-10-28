import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import RNEventSource from 'react-native-sse';

import { API_URL, USE_MOCKS } from '@/lib/constants';
import { parsePresaleStreamMessage } from '@/lib/presale';
import { presaleEndpoints, useLazyGetPresaleStreamTokenQuery, type PresaleStreamMessage } from '@/store/api/presaleApi';

export const PRESALE_BACKOFF_MIN_MS = 1000;
export const PRESALE_BACKOFF_MAX_MS = 30000;

export type PresaleStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'paused';

export interface PresaleRealtimeOptions {
  eventId: number | undefined;
  enabled: boolean;
  onMessage: (message: PresaleStreamMessage) => void;
  onResync: () => void;
}

export function presaleBackoffMs(failures: number): number {
  return Math.min(PRESALE_BACKOFF_MAX_MS, PRESALE_BACKOFF_MIN_MS * 2 ** Math.max(0, failures - 1));
}

export function usePresaleRealtime({ eventId, enabled, onMessage, onResync }: PresaleRealtimeOptions): PresaleStreamStatus {
  const [fetchStreamToken] = useLazyGetPresaleStreamTokenQuery();
  const callbacksRef = useRef({ onMessage, onResync });
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<PresaleStreamStatus>('connecting');
  const connectedOnceRef = useRef(false);
  const connectedEventIdRef = useRef(eventId);

  useEffect(() => {
    callbacksRef.current = { onMessage, onResync };
  }, [onMessage, onResync]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (USE_MOCKS || !enabled || !focused || eventId == null) return;
    const streamEventId = eventId;
    let closed = false;
    let source: RNEventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    if (connectedEventIdRef.current !== streamEventId) {
      connectedEventIdRef.current = streamEventId;
      connectedOnceRef.current = false;
    }
    let paused = false;
    let attempt = 0;

    const clearReconnect = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const closeSource = () => {
      const current = source;
      source = null;
      if (!current) return;
      current.removeAllEventListeners();
      current.close();
    };

    const scheduleReconnect = () => {
      if (closed) return;
      failures += 1;
      setStatus('reconnecting');
      clearReconnect();
      reconnectTimer = setTimeout(() => {
        void connect();
      }, presaleBackoffMs(failures));
    };

    async function connect() {
      if (closed) return;
      attempt += 1;
      const currentAttempt = attempt;
      clearReconnect();
      closeSource();
      let streamToken: string;
      try {
        streamToken = (await fetchStreamToken(streamEventId).unwrap()).stream_token;
      } catch {
        if (closed || paused || currentAttempt !== attempt) return;
        scheduleReconnect();
        return;
      }
      if (closed || paused || currentAttempt !== attempt) return;
      const next = new RNEventSource(`${API_URL}${presaleEndpoints.stream(streamEventId, streamToken)}`, { pollingInterval: 0 });
      source = next;
      next.addEventListener('open', () => {
        if (closed || source !== next) return;
        failures = 0;
        setStatus('live');
        if (connectedOnceRef.current) callbacksRef.current.onResync();
        connectedOnceRef.current = true;
      });
      next.addEventListener('message', (event) => {
        if (closed || source !== next || event.data == null) return;
        const parsed = parsePresaleStreamMessage(event.data);
        if (parsed) callbacksRef.current.onMessage(parsed);
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
        paused = false;
        failures = 0;
        if (!source) void connect();
        return;
      }
      paused = true;
      clearReconnect();
      closeSource();
      setStatus('paused');
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void connect();

    return () => {
      closed = true;
      clearReconnect();
      subscription.remove();
      closeSource();
      setStatus('connecting');
    };
  }, [enabled, focused, eventId, fetchStreamToken]);

  return status;
}
