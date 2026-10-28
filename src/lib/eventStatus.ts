export type EventTimeStatus = 'finished' | 'live' | 'today' | 'upcoming';

export interface EventTimeSource {
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  time_is_tba?: boolean;
}

export function combineDateTime(
  date?: string | null,
  time?: string | null,
  fallbackTime = '00:00:00',
): Date | null {
  if (!date) return null;

  if (date.includes('T')) {
    const isoParsed = new Date(date);
    return Number.isNaN(isoParsed.getTime()) ? null : isoParsed;
  }

  let safeTime = (time || fallbackTime).slice(0, 8);
  if (safeTime.length === 5) safeTime = `${safeTime}:00`;

  const parsed = new Date(`${date}T${safeTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hasKnownStartTime(event: EventTimeSource): boolean {
  if (event.time_is_tba) return false;
  if (event.start_time) return true;
  return Boolean(event.start_date?.includes('T'));
}

export function eventEndsAt(event: EventTimeSource): Date | null {
  let end = combineDateTime(event.end_date || event.start_date, event.end_time, '23:59:59');
  if (!end) end = combineDateTime(event.start_date, null, '23:59:59');
  if (!end) return null;

  const start = combineDateTime(event.start_date, event.start_time);
  if (start && end < start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  return end;
}

export function getEventTimeStatus(event: EventTimeSource, now = new Date()): EventTimeStatus | null {
  const start = combineDateTime(event.start_date, event.start_time);
  if (!start) return null;

  const end = eventEndsAt(event);
  if (end && now > end) return 'finished';
  if (now >= start) {
    if (!hasKnownStartTime(event) && isSameDay(start, now)) return 'today';
    return 'live';
  }
  if (isSameDay(start, now)) return 'today';
  return 'upcoming';
}
