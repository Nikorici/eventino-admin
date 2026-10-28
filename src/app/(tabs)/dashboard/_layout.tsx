import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'index' };

export default function DashboardLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
