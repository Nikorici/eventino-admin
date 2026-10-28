import { useMemo } from 'react';

import { sectionAccess, visibleSections, type SectionGroup, type TabKey } from '@/lib/sections';
import { useGetScannedTicketsQuery } from '@/store/api/stickersApi';
import { useAppSelector } from '@/store/hooks';

import { useSelectedEvent } from './useSelectedEvent';

function hasStickerAccess(result: ReturnType<typeof useGetScannedTicketsQuery>): boolean {
  if (result.isSuccess) return true;
  const error = result.error;
  if (error && 'status' in error && typeof error.status === 'number') {
    return error.status !== 401 && error.status !== 403;
  }
  return false;
}

export function useSections(tab: TabKey): {
  groups: SectionGroup[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const user = useAppSelector((s) => s.auth.user);
  const selected = useSelectedEvent();
  const stickers = useGetScannedTicketsQuery(1, { skip: !user || Boolean(user.is_staff) });
  const stickerAccess = hasStickerAccess(stickers);

  const groups = useMemo(
    () => visibleSections(tab, sectionAccess({ user, event: selected.data, hasStickerAccess: stickerAccess })),
    [tab, user, selected.data, stickerAccess],
  );

  const eventScoped = tab !== 'more';

  return {
    groups,
    isLoading: eventScoped ? selected.isLoading : false,
    isError: eventScoped ? selected.isError : false,
    refetch: () => {
      if (eventScoped && selected.eventId != null) void selected.refetch();
      else if (!user?.is_staff) void stickers.refetch();
    },
  };
}
