import { FontAwesome5 } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { NativeTabs } from 'expo-router/native-tabs';
import { ChartColumn, Ellipsis, House, SlidersHorizontal, Ticket, type LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Screen } from '@/components/ui';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSelectedEventId } from '@/hooks/useSelectedEvent';
import { cn } from '@/lib/cn';
import { href, routes } from '@/lib/nav';
import { useAppSelector } from '@/store/hooks';
import { colors } from '@/theme/colors';
import type { SFSymbol } from 'expo-symbols';

interface TabSpec {
  name: 'dashboard' | 'sales' | 'analytics' | 'manage' | 'more';
  label: string;
  icon: LucideIcon;
  sf: SFSymbol;
  fa: string;
}

const TABS: TabSpec[] = [
  { name: 'dashboard', label: 'Dashboard', icon: House, sf: 'house', fa: 'home' },
  { name: 'sales', label: 'Sales', icon: Ticket, sf: 'ticket', fa: 'ticket-alt' },
  { name: 'analytics', label: 'Analytics', icon: ChartColumn, sf: 'chart.bar.xaxis', fa: 'chart-bar' },
  { name: 'manage', label: 'Manage', icon: SlidersHorizontal, sf: 'slider.horizontal.3', fa: 'sliders-h' },
  { name: 'more', label: 'More', icon: Ellipsis, sf: 'ellipsis', fa: 'ellipsis-h' },
];

function useTabColors() {
  const isDark = useColorScheme() === 'dark';
  return {
    isDark,
    selected: isDark ? colors.dark.text : colors.primary,
    idle: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  };
}

function WebTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { selected, idle } = useTabColors();
  return (
    <View
      className="absolute bottom-6 left-4 right-4 h-16 flex-row items-center rounded-full border border-white/60 bg-[#fafafa]/[0.82] px-1 py-[3px] backdrop-blur-[24px] dark:border-white/[0.12] dark:bg-[#1e1e1e]/[0.78]"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const focused = index === state.index;
        const color = focused ? selected : idle;
        const Icon = tab.icon;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            aria-selected={focused}
            accessibilityLabel={t(tab.label)}
            className={cn('h-14 flex-1 items-center justify-center gap-0.5 rounded-full', focused && 'bg-black/[0.06] dark:bg-white/10')}
          >
            <Icon size={24} color={color} />
            <AppText style={{ color }} className={cn('text-[10px] leading-3', focused ? 'font-gilroy-bold' : 'font-gilroy-semibold')}>
              {t(tab.label)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function WebTabsLayout() {
  const { t } = useTranslation();
  const { isDark } = useTabColors();
  return (
    <Tabs
      tabBar={(props) => <WebTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: isDark ? colors.dark.background : colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.label) }} />
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
          <NativeTabs.Trigger.Icon sf={tab.sf} src={<NativeTabs.Trigger.VectorIcon family={FontAwesome5} name={tab.fa} />} />
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
