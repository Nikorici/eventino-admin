import { Redirect } from 'expo-router';

import { Screen } from '@/components/ui';
import { useSelectedEventId } from '@/hooks/useSelectedEvent';
import { href, routes } from '@/lib/nav';
import { useAppSelector } from '@/store/hooks';

export default function Gate() {
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const restored = useAppSelector((s) => s.selectedEvent.restored);
  const selectedEventId = useSelectedEventId();

  if (isBootstrapping || !restored) return <Screen>{null}</Screen>;
  if (!isAuthenticated) return <Redirect href={href(routes.login)} />;
  if (selectedEventId == null) return <Redirect href={href(routes.selectEvent)} />;
  return <Redirect href={href(routes.dashboard)} />;
}
