import { FontAwesome5 } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedEventId } from '@/hooks/useSelectedEvent';
import { href, routes } from '@/lib/nav';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';
import type { SFSymbol } from 'expo-symbols';

interface TabSpec {
  name: 'dashboard' | 'sales' | 'analytics' | 'manage' | 'more';
  label: string;
  sf: SFSymbol;
  sfSelected: SFSymbol;
  fa: string;
}

const TABS: TabSpec[] = [
  { name: 'dashboard', label: 'Dashboard', sf: 'square.grid.2x2', sfSelected: 'square.grid.2x2.fill', fa: 'th-large' },
  { name: 'sales', label: 'Sales', sf: 'ticket', sfSelected: 'ticket.fill', fa: 'ticket-alt' },
  { name: 'analytics', label: 'Analytics', sf: 'chart.bar', sfSelected: 'chart.bar.fill', fa: 'chart-bar' },
  { name: 'manage', label: 'Manage', sf: 'slider.horizontal.3', sfSelected: 'slider.horizontal.3', fa: 'sliders-h' },
  { name: 'more', label: 'More', sf: 'ellipsis.circle', sfSelected: 'ellipsis.circle.fill', fa: 'ellipsis-h' },
];

function useTabColors() {
  const isDark = useColorScheme() === 'dark';
  return {
    isDark,
    selected: isDark ? colors.dark.text : colors.primary,
    idle: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  };
}

function WebTabsLayout() {
  const { t } = useTranslation();
  const { isDark, selected, idle } = useTabColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: selected,
        tabBarInactiveTintColor: idle,
        tabBarLabelStyle: { fontFamily: 'Gilroy-Semibold', fontSize: 10 },
        tabBarStyle: {
          backgroundColor: isDark ? colors.dark.surface : colors.surface,
          borderTopColor: isDark ? colors.dark.border : colors.border,
        },
        sceneStyle: { backgroundColor: isDark ? colors.dark.background : colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color }) => <FontAwesome5 name={tab.fa} size={18} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}

function NativeTabsLayout() {
  const { t } = useTranslation();
  const { isDark, selected, idle } = useTabColors();
  return (
    <NativeTabs
      blurEffect={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      tintColor={selected}
      iconColor={{ default: idle, selected }}
      labelStyle={{
        default: { fontFamily: 'Gilroy-Semibold', fontSize: 10, color: idle },
        selected: { fontFamily: 'Gilroy-Bold', fontSize: 10, color: selected },
      }}
      minimizeBehavior="onScrollDown"
      disableTransparentOnScrollEdge
    >
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon
            sf={{ default: tab.sf, selected: tab.sfSelected }}
            src={<NativeTabs.Trigger.VectorIcon family={FontAwesome5} name={tab.fa} />}
          />
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

export default function TabsLayout() {
  const isBootstrapping = useAppSelector((s) => s.auth.isBootstrapping);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const restored = useAppSelector((s) => s.selectedEvent.restored);
  const selectedEventId = useSelectedEventId();

  if (isBootstrapping || !restored) return <Screen>{null}</Screen>;
  if (!isAuthenticated) return <Redirect href={href(routes.login)} />;
  if (selectedEventId == null) return <Redirect href={href(routes.home)} />;

  return Platform.OS === 'web' ? <WebTabsLayout /> : <NativeTabsLayout />;
}
