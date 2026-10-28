import { useCallback, useEffect } from 'react';

import { STORAGE_KEYS } from '@/lib/constants';
import { cache } from '@/lib/storage';
import { useGetEventDetailQuery } from '@/store/api/eventsApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  eventSelected,
  selectedEventCleared,
  selectedEventRestored,
  type SelectedEventValue,
} from '@/store/slices/selectedEventSlice';

export function useBootstrapSelectedEvent(): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await cache.get<SelectedEventValue>(STORAGE_KEYS.selectedEvent);
      const valid = stored && typeof stored.eventId === 'number' && typeof stored.organizerId === 'number';
      if (active) dispatch(selectedEventRestored(valid ? stored : null));
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);
}

export function useSelectedEventId(): number | null {
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const { eventId, organizerId } = useAppSelector((s) => s.selectedEvent);
  if (eventId == null || userId == null || organizerId !== userId) return null;
  return eventId;
}

export function useSelectedEvent() {
  const eventId = useSelectedEventId();
  const query = useGetEventDetailQuery(eventId ?? 0, { skip: eventId == null });
  return { eventId, ...query };
}

export function useSelectEvent() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);

  return useCallback(
    async (eventId: number) => {
      if (userId == null) return;
      const value: SelectedEventValue = { eventId, organizerId: userId };
      dispatch(eventSelected(value));
      await cache.set(STORAGE_KEYS.selectedEvent, value);
    },
    [dispatch, userId],
  );
}

export function useClearSelectedEvent() {
  const dispatch = useAppDispatch();
  return useCallback(async () => {
    dispatch(selectedEventCleared());
    await cache.remove(STORAGE_KEYS.selectedEvent);
  }, [dispatch]);
}
