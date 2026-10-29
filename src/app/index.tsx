import { Redirect } from 'expo-router';

import { Screen } from '@/components/ui';
import { href, routes } from '@/lib/nav';
import { useAppSelector } from '@/store/hooks';

export default function Gate() {
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const restored = useAppSelector((s) => s.selectedEvent.restored);

  if (isBootstrapping || !restored) return <Screen>{null}</Screen>;
  if (!isAuthenticated) return <Redirect href={href(routes.login)} />;
  return <Redirect href={href(routes.home)} />;
}
