import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { dateFnsLocale } from '@/lib/format';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AppText, PressableScale } from '@/components/ui';

export interface DateFilter {
  startDate: string;
  endDate: string;
  label: string;
}

const DAYS_TO_SHOW = 45;

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function rangeLabel(start: string, end: string, lang: string): string {
  const locale = dateFnsLocale(lang);
  const startDate = new Date(`${start}T00:00:00`);
  if (start === end) return format(startDate, 'd MMM', { locale });
  const endDate = new Date(`${end}T00:00:00`);
  return `${format(startDate, 'd MMM', { locale })} – ${format(endDate, 'd MMM', { locale })}`;
}

interface DayChipProps {
  dayKey: string;
  weekday: string;
  dayNumber: string;
  accessibilityLabel: string;
  filterLabel: string;
  hasEvents: boolean;
  isToday: boolean;
  isActive: boolean;
  dotColor: string;
  activeDotColor: string;
  onSelect: (key: string, label: string) => void;
}

const DayChip = memo(function DayChip({
  dayKey,
  weekday,
  dayNumber,
  accessibilityLabel,
  filterLabel,
  hasEvents,
  isToday,
  isActive,
  dotColor,
  activeDotColor,
  onSelect,
}: DayChipProps) {
  return (
    <PressableScale
      onPress={() => onSelect(dayKey, filterLabel)}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'h-[68px] w-[52px] items-center justify-center gap-0.5 rounded-[14px] border',
        isActive
          ? 'border-primary bg-primary dark:border-white dark:bg-white'
          : isToday
            ? 'border-primary/40 bg-white dark:border-white/40 dark:bg-dark-surface'
            : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
      )}
    >
      <AppText
        className={cn(
          'font-gilroy-medium text-[11px] uppercase',
          isActive ? 'text-white dark:text-primary' : 'text-muted',
        )}
      >
        {weekday}
      </AppText>
      <AppText
        className={cn(
          'font-gilroy-bold text-[18px] leading-[20px]',
          isActive ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text',
        )}
      >
        {dayNumber}
      </AppText>
      <View
        className={cn('h-1 w-1 rounded-full', hasEvents ? '' : 'opacity-0')}
        style={{ backgroundColor: isActive ? activeDotColor : dotColor }}
      />
    </PressableScale>
  );
});

interface MonthGridProps {
  datesWithEvents: Set<string>;
  onApply: (filter: DateFilter) => void;
  onReset: () => void;
  onClose: () => void;
  lang: string;
}

function MonthGrid({ datesWithEvents, onApply, onReset, onClose, lang }: MonthGridProps) {
  const { t } = useTranslation();
  const locale = dateFnsLocale(lang);
  const isDark = useColorScheme() === 'dark';
  const dotColor = useThemeColor(colors.links, colors.accent);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), 'EEEEE', { locale }));
  }, [locale]);

  const onDayPress = (day: Date) => {
    haptics.selection();
    if (!start || (start && end)) {
      setStart(day);
      setEnd(null);
      return;
    }
    if (day < start) {
      setStart(day);
      return;
    }
    setEnd(day);
  };

  const inRange = (day: Date): boolean => {
    if (!start) return false;
    const upper = end ?? start;
    return day >= startOfDay(start) && day <= startOfDay(upper);
  };

  const apply = () => {
    if (!start) return;
    const upper = end ?? start;
    const s = ymd(start);
    const e = ymd(upper);
    onApply({ startDate: s, endDate: e, label: rangeLabel(s, e, lang) });
  };

  return (
    <View className="rounded-t-[24px] bg-app-bg px-4 pb-8 pt-3 dark:bg-dark-bg">
      <View className="mb-3 items-center">
        <View className="h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
      </View>

      <View className="mb-3 flex-row items-center justify-between">
        <PressableScale
          onPress={() => setMonth(subMonths(month, 1))}
          accessibilityLabel={t('Previous')}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
        >
          <ChevronLeft size={20} color={isDark ? colors.dark.text : colors.primary} />
        </PressableScale>
        <AppText className="font-gilroy-bold text-[17px] capitalize">{format(month, 'LLLL yyyy', { locale })}</AppText>
        <PressableScale
          onPress={() => setMonth(addMonths(month, 1))}
          accessibilityLabel={t('Next')}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
        >
          <ChevronRight size={20} color={isDark ? colors.dark.text : colors.primary} />
        </PressableScale>
      </View>

      <View className="mb-1 flex-row">
        {weekdayLabels.map((label, index) => (
          <View key={index} className="flex-1 items-center py-1">
            <AppText className="font-gilroy-semibold text-[12px] uppercase text-muted">{label}</AppText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} className="flex-row">
          {week.map((day) => {
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const active = inRange(day);
            const isEdge = (start && isSameDay(day, start)) || (end && isSameDay(day, end));
            const hasEvents = datesWithEvents.has(ymd(day));
            return (
              <Pressable key={day.toISOString()} onPress={() => onDayPress(day)} className="flex-1 items-center py-1">
                <View
                  className={cn(
                    'h-10 w-10 items-center justify-center rounded-full',
                    isEdge
                      ? 'bg-primary dark:bg-white'
                      : active
                        ? 'bg-primary/10 dark:bg-white/15'
                        : '',
                  )}
                >
                  <AppText
                    className={cn(
                      'font-gilroy-semibold text-[14px]',
                      isEdge
                        ? 'text-white dark:text-primary'
                        : isCurrentMonth
                          ? 'text-primary dark:text-dark-text'
                          : 'text-muted/50',
                    )}
                  >
                    {format(day, 'd', { locale })}
                  </AppText>
                  {hasEvents && !isEdge ? (
                    <View className="absolute bottom-1 h-1 w-1 rounded-full" style={{ backgroundColor: dotColor }} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1">
          <PressableScale
            onPress={() => {
              setStart(null);
              setEnd(null);
              onReset();
            }}
            accessibilityLabel={t('Reset')}
            className="h-12 w-full items-center justify-center rounded-[12px] border border-app-border dark:border-dark-border"
          >
            <AppText className="font-gilroy-semibold text-[15px] text-primary dark:text-dark-text">{t('Reset')}</AppText>
          </PressableScale>
        </View>
        <View className="flex-1">
          <PressableScale
            onPress={apply}
            disabled={!start}
            accessibilityLabel={t('Apply')}
            className={cn(
              'h-12 w-full items-center justify-center rounded-[12px]',
              start ? 'bg-primary dark:bg-white' : 'bg-primary/40 dark:bg-white/30',
            )}
          >
            <AppText className="font-gilroy-bold text-[15px] text-white dark:text-primary">{t('Apply')}</AppText>
          </PressableScale>
        </View>
      </View>

      <Pressable
        onPress={onClose}
        accessibilityLabel={t('Close')}
        className="absolute right-4 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
      >
        <X size={18} color={isDark ? colors.dark.text : colors.primary} />
      </Pressable>
    </View>
  );
}

export interface EventDateStripProps {
  datesWithEvents: Set<string>;
  value: DateFilter | null;
  onChange: (value: DateFilter | null) => void;
}

export function EventDateStrip({ datesWithEvents, value, onChange }: EventDateStripProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isDark = useColorScheme() === 'dark';
  const dotColor = useThemeColor(colors.links, colors.accent);
  const activeDotColor = isDark ? colors.primary : colors.white;
  const [pickerOpen, setPickerOpen] = useState(false);

  const days = useMemo(() => {
    const locale = dateFnsLocale(lang);
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS_TO_SHOW }, (_, index) => {
      const date = addDays(today, index);
      return {
        key: ymd(date),
        weekday: format(date, 'EEE', { locale }),
        dayNumber: format(date, 'd', { locale }),
        accessibilityLabel: format(date, 'PPP', { locale }),
        filterLabel: format(date, 'd MMM', { locale }),
        isToday: index === 0,
      };
    });
  }, [lang]);

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleSelect = useCallback(
    (key: string, label: string) => {
      haptics.selection();
      const current = valueRef.current;
      if (current && current.startDate === key && current.endDate === key) {
        onChange(null);
        return;
      }
      onChange({ startDate: key, endDate: key, label });
    },
    [onChange],
  );

  return (
    <View className="gap-2.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      >
        <PressableScale
          onPress={() => {
            haptics.light();
            setPickerOpen(true);
          }}
          accessibilityLabel={t('Open calendar')}
          className={cn(
            'h-[68px] w-[52px] items-center justify-center gap-1 rounded-[14px] border',
            value
              ? 'border-primary bg-primary dark:border-white dark:bg-white'
              : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
          )}
        >
          <CalendarDays size={22} color={value ? (isDark ? colors.primary : colors.white) : isDark ? colors.dark.text : colors.primary} />
          <AppText
            numberOfLines={1}
            className={cn('font-gilroy-semibold text-[10px]', value ? 'text-white dark:text-primary' : 'text-muted')}
          >
            {value ? t('Dates') : t('All')}
          </AppText>
        </PressableScale>

        {days.map((day) => (
          <DayChip
            key={day.key}
            dayKey={day.key}
            weekday={day.weekday}
            dayNumber={day.dayNumber}
            accessibilityLabel={day.accessibilityLabel}
            filterLabel={day.filterLabel}
            hasEvents={datesWithEvents.has(day.key)}
            isToday={day.isToday}
            isActive={value != null && day.key >= value.startDate && day.key <= value.endDate}
            dotColor={dotColor}
            activeDotColor={activeDotColor}
            onSelect={handleSelect}
          />
        ))}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPickerOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <MonthGrid
              datesWithEvents={datesWithEvents}
              lang={lang}
              onApply={(filter) => {
                onChange(filter);
                setPickerOpen(false);
              }}
              onReset={() => {
                onChange(null);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
