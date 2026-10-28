import { useCallback } from 'react';

import { navigate } from '@/lib/nav';
import { useAppSelector } from '@/store/hooks';

export function useRequireAuth() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  return useCallback(
    (action?: () => void): boolean => {
      if (!isAuthenticated) {
        navigate.login();
        return false;
      }
      action?.();
      return true;
    },
    [isAuthenticated],
  );
}
