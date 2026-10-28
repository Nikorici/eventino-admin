import { format, isToday, isTomorrow, differenceInCalendarDays, type Locale } from 'date-fns';
import { enUS, ro, ru } from 'date-fns/locale';

import { combineDateTime, getEventTimeStatus, type EventTimeSource } from '@/lib/eventStatus';
import { currencySymbol } from '@/theme/colors';
import type { Category, EventDetail, EventListItem, TicketType, User } from '@/types/api';

const dateLocales: Record<string, Locale> = { en: enUS, ro, ru };

export function dateFnsLocale(lang: string): Locale {
  return dateLocales[lang.split('-')[0]] ?? enUS;
}

export function parseEventDate(date?: string | null, time?: string | null): Date | null {
  if (!date) return null;
  const safeTime = (time ?? '00:00:00').slice(0, 8);
  const value = new Date(`${date}T${safeTime.length === 5 ? `${safeTime}:00` : safeTime}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function formatTime(time?: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

export interface EventTimeLabelSource {
  start_time?: string | null;
  end_time?: string | null;
  time_is_tba?: boolean;
}

export function formatEventStartTime(event: EventTimeLabelSource): string {
  if (event.time_is_tba) return '';
  return formatTime(event.start_time);
}

export function formatEventTimeRange(event: EventTimeLabelSource, tbaLabel: string): string {
  if (event.time_is_tba) return tbaLabel;
  const start = formatTime(event.start_time);
  if (!start) return '';
  const end = formatTime(event.end_time);
  return end ? `${start} - ${end}` : start;
}

export function formatEventDay(date?: string | null, lang = 'en'): string {
  const parsed = parseEventDate(date);
  if (!parsed) return '';
  return format(parsed, 'EEE, d MMM', { locale: dateFnsLocale(lang) });
}

export function formatLongDate(date?: string | null, lang = 'en'): string {
  const parsed = parseEventDate(date);
  if (!parsed) return '';
  return format(parsed, 'd MMMM yyyy', { locale: dateFnsLocale(lang) });
}

export function formatSaleMoment(value?: string | null, lang = 'en'): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) });
}

export function getCategoryNames(event: { categories?: (string | Category)[] }): string[] {
  if (!event.categories) return [];
  return event.categories.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
}

export function isTicketOnSale(ticket: TicketType, now = new Date()): boolean {
  if (ticket.is_active === false || ticket.is_archived === true) return false;
  if (ticket.sale_start_date && now < new Date(ticket.sale_start_date)) return false;
  if (ticket.sale_end_date && now > new Date(ticket.sale_end_date)) return false;
  return true;
}

function currencyFromTickets(tickets?: TicketType[]): string | null {
  for (const ticket of tickets ?? []) {
    const code = ticket?.currency;
    if (typeof code !== 'string' || !code) continue;
    if (/^[A-Z]{3}$/.test(code)) return code;
    if (code === '$') return 'USD';
    if (code === '€') return 'EUR';
    if (code.length <= 3) return code.toUpperCase();
  }
  return null;
}

export function eventCurrencyCode(event: EventListItem | EventDetail): string {
  return event.currency || currencyFromTickets(event.ticket_types) || 'USD';
}

export interface PriceInfo {
  label: string;
  amount: number | null;
  isFree: boolean;
  isSoldOut: boolean;
  currency: string;
}

export function priceInfo(event: EventListItem | EventDetail, freeLabel = 'Free', soldOutLabel = 'Sold out'): PriceInfo {
  const tickets = event.ticket_types ?? [];
  const code = eventCurrencyCode(event);
  const symbol = currencySymbol(code);
  const sellable = tickets.filter((ticket) => isTicketOnSale(ticket));

  if (tickets.length > 0 && sellable.length === 0) {
    return { label: soldOutLabel, amount: null, isFree: false, isSoldOut: true, currency: code };
  }

  const prices = sellable.map((t) => Number(t.price)).filter((n) => !Number.isNaN(n));
  const min = prices.length ? Math.min(...prices) : null;

  if (min == null || min <= 0) {
    return { label: freeLabel, amount: 0, isFree: true, isSoldOut: false, currency: code };
  }

  const rounded = Math.round(min);
  const display = String(min).endsWith('.99') ? min.toFixed(2) : String(rounded);
  return { label: `${symbol} ${display}`, amount: min, isFree: false, isSoldOut: false, currency: code };
}

export type EventRecency =
  | 'passed'
  | 'live'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'under_week'
  | 'this_month'
  | 'next_month'
  | 'next_year';

function startOfIsoWeek(reference: Date): Date {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return start;
}

export function eventRecency(event: EventTimeSource): EventRecency | null {
  const now = new Date();
  const status = getEventTimeStatus(event, now);
  if (status === 'finished') return 'passed';
  if (status === 'live') return 'live';

  const start = combineDateTime(event.start_date, event.start_time);
  if (!start) return null;
  if (isToday(start)) return 'today';
  if (isTomorrow(start)) return 'tomorrow';

  const endOfWeek = startOfIsoWeek(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  if (start < endOfWeek) return 'this_week';

  if (differenceInCalendarDays(start, now) <= 7) return 'under_week';
  if (start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear()) return 'this_month';
  if (start.getMonth() === now.getMonth() + 1 && start.getFullYear() === now.getFullYear()) return 'next_month';
  if (start.getFullYear() === now.getFullYear() + 1) return 'next_year';
  return null;
}

export function isEventPassed(event: EventTimeSource): boolean {
  return getEventTimeStatus(event) === 'finished';
}

export function sortEventsUpcomingFirst<T extends EventTimeSource>(events: T[]): T[] {
  const now = new Date();
  const startMs = (event: T) => combineDateTime(event.start_date, event.start_time)?.getTime() ?? 0;
  const ended = (event: T) => getEventTimeStatus(event, now) === 'finished';
  return [...events].sort((a, b) => {
    const aEnded = ended(a);
    const bEnded = ended(b);
    if (!aEnded && bEnded) return -1;
    if (aEnded && !bEnded) return 1;
    return aEnded ? startMs(b) - startMs(a) : startMs(a) - startMs(b);
  });
}

export function eventImageUri(event: { images?: string[]; event_images?: { image: string; order: number }[] }): string | null {
  if (event.event_images && event.event_images.length > 0) {
    return [...event.event_images].sort((a, b) => a.order - b.order)[0].image;
  }
  if (event.images && event.images.length > 0) return event.images[0];
  return null;
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

export function eventMedia(event: EventDetail): MediaItem[] {
  const images: MediaItem[] =
    event.event_images && event.event_images.length > 0
      ? [...event.event_images].sort((a, b) => a.order - b.order).map((i) => ({ type: 'image', url: i.image }))
      : (event.images ?? []).map((url) => ({ type: 'image', url }));

  if (event.video) {
    const media: MediaItem[] = [...images];
    const idx = Number.isInteger(event.video_order) ? Math.min(Math.max(event.video_order ?? 0, 0), media.length) : media.length;
    media.splice(idx, 0, { type: 'video', url: event.video });
    return media;
  }
  return images;
}

export function isVisibleEvent(event: EventListItem, user?: User | null): boolean {
  if (event.in_draft) return false;
  if (event.type === 'PRIVATE') return false;
  if (event.type === 'PERSONAL') return Boolean(user?.is_full_confirmation);
  return true;
}

export function coordinatesToLatLng(coords?: { lat: string | number; long: string | number }): { latitude: number; longitude: number } | null {
  if (!coords) return null;
  const latitude = parseFloat(String(coords.lat));
  const longitude = parseFloat(String(coords.long));
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
}

export function locationLine(event: EventListItem | EventDetail): string {
  if (event.event_location_type === 'virtual' || event.event_location_type === 'ONLINE') return 'Virtual';
  if (event.location_is_tba || !event.address) return `${event.region || 'TBA'}, ${event.country}`;
  return `${event.region}, ${event.country}`;
}

export function followersCount(event: EventListItem): number {
  return Array.isArray(event.followers) ? event.followers.length : 0;
}
