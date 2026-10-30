import { useCallback, useRef, useState } from 'react';

import { ACTION_COOLDOWN_MS, wait } from './printingLogic';

export function useBusyKeys() {
  const busyRef = useRef(new Set<string>());
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  const update = useCallback((change: (next: Set<string>) => void) => {
    const next = new Set(busyRef.current);
    change(next);
    busyRef.current = next;
    setBusy(next);
  }, []);

  const run = useCallback(
    async (key: string, action: () => Promise<boolean>, cooldown = ACTION_COOLDOWN_MS): Promise<boolean> => {
      if (busyRef.current.has(key)) return false;
      update((next) => next.add(key));
      let succeeded = false;
      try {
        succeeded = await action();
        if (succeeded) await wait(cooldown);
      } finally {
        update((next) => next.delete(key));
      }
      return succeeded;
    },
    [update],
  );

  return { isBusy: (key: string) => busy.has(key), run };
}
