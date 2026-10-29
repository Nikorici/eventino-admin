import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'index' };

export default function ManageLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
