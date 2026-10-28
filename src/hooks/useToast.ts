import { useCallback } from 'react';

import { useAppDispatch } from '@/store/hooks';
import { showToast, type ToastType } from '@/store/slices/uiSlice';

export function useToast() {
  const dispatch = useAppDispatch();
  return useCallback(
    (message: string, type: ToastType = 'info') => {
      dispatch(showToast({ message, type }));
    },
    [dispatch],
  );
}
