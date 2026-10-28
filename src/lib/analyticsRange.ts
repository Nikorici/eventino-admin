import { format, type Locale } from 'date-fns';

export type ChartViewMode = 'month' | 'week' | 'day';

export interface TimelineSlot {
  key: string;
  tooltipLabel: string;
  axisLabel: string;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date): Date {
  const clean = startOfDay(date);
  return addDays(clean, -((clean.getDay() + 6) % 7));
}

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface ChartLifecycle {
  start: Date | null;
  end: Date | null;
}

export function parseBoundaryDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

export function clampToLifecycle(range: { start: Date; end: Date }, lifecycle?: ChartLifecycle | null): { start: Date; end: Date } {
  if (!lifecycle) return range;
  let { start, end } = range;
  if (lifecycle.start && lifecycle.start > start) start = lifecycle.start;
  if (lifecycle.end && lifecycle.end < end) end = lifecycle.end;
  return { start, end };
}

export function windowRange(mode: ChartViewMode, anchor: Date): { start: Date; end: Date } {
  if (mode === 'month') {
    return {
      start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
    };
  }
  if (mode === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  const day = startOfDay(anchor);
  return { start: day, end: day };
}

export function shiftAnchor(mode: ChartViewMode, anchor: Date, direction: 1 | -1): Date {
  if (mode === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  if (mode === 'week') return addDays(startOfWeek(anchor), direction * 7);
  return addDays(startOfDay(anchor), direction);
}

export function periodRangeLabel(mode: ChartViewMode, anchor: Date, locale: Locale): string {
  if (mode === 'month') return format(anchor, 'LLLL yyyy', { locale });
  if (mode === 'week') {
    const { start, end } = windowRange('week', anchor);
    return `${format(start, 'd MMM', { locale })} – ${format(end, 'd MMM yyyy', { locale })}`;
  }
  return format(anchor, 'd MMM yyyy', { locale });
}

export function buildTimelineSlots(
  mode: ChartViewMode,
  anchor: Date,
  locale: Locale,
  lifecycle?: ChartLifecycle | null,
): TimelineSlot[] {
  if (mode === 'day') {
    const dayKey = dateKey(anchor);
    const dayLabel = format(anchor, 'd MMM', { locale });
    return Array.from({ length: 24 }, (_, hour) => {
      const hourLabel = `${String(hour).padStart(2, '0')}:00`;
      return { key: `${dayKey}-${String(hour).padStart(2, '0')}`, tooltipLabel: `${dayLabel}, ${hourLabel}`, axisLabel: hourLabel };
    });
  }
  const { start, end } = clampToLifecycle(windowRange(mode, anchor), lifecycle);
  const slots: TimelineSlot[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    slots.push({
      key: dateKey(cursor),
      tooltipLabel: format(cursor, 'd MMM yyyy', { locale }),
      axisLabel: format(cursor, 'd MMM', { locale }),
    });
    cursor = addDays(cursor, 1);
  }
  return slots;
}
