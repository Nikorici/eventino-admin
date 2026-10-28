import type { PresaleRegistrationRow, PresaleStreamMessage, PresaleSummary } from '@/store/api/presaleApi';

export const UNKNOWN_SOURCE = 'unknown';

const SOURCE_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  'tiktok-ads': 'TikTok Ads',
  google: 'Google',
  'google-ads': 'Google Ads',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  eventino: 'Eventino',
  bing: 'Bing',
  yandex: 'Yandex',
};

export interface PresaleFilter {
  q: string;
  source: string;
}

export function matchesFilter(row: PresaleRegistrationRow, { q, source }: PresaleFilter): boolean {
  if (source && row.traffic_source !== source) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return row.email.toLowerCase().includes(needle) || (row.phone ?? '').toLowerCase().includes(needle);
}

export function refreshRegistrations(
  current: PresaleRegistrationRow[],
  currentNextBefore: number | null,
  page: { registrations: PresaleRegistrationRow[]; next_before: number | null },
): { rows: PresaleRegistrationRow[]; nextBefore: number | null } {
  const fresh = new Map(page.registrations.map((row) => [row.id, row]));
  const kept = current.filter((row) => !fresh.has(row.id));
  const rows = [...page.registrations, ...kept].sort((a, b) => b.id - a.id);
  const freshOldest = page.registrations.length ? page.registrations[page.registrations.length - 1].id : null;
  const loadedDeeper = current.length > 0 && freshOldest !== null && current[current.length - 1].id < freshOldest;
  return { rows, nextBefore: loadedDeeper ? currentNextBefore : page.next_before };
}

export function mergeRegistrations(current: PresaleRegistrationRow[], incoming: PresaleRegistrationRow[]): PresaleRegistrationRow[] {
  const seen = new Set(current.map((row) => row.id));
  const fresh = incoming.filter((row) => !seen.has(row.id));
  if (!fresh.length) return current;
  return [...fresh, ...current].sort((a, b) => b.id - a.id);
}

export function percentOf(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

export function sourceShares(summary: PresaleSummary | null | undefined) {
  const total = summary?.total ?? 0;
  return (summary?.sources ?? []).map((item) => ({ ...item, percent: percentOf(item.count, total) }));
}

export function sourceLabel(source: string, t: (key: string) => string): string {
  if (source === 'direct') return t('Direct');
  if (!source || source === UNKNOWN_SOURCE) return t('Unknown');
  return Object.prototype.hasOwnProperty.call(SOURCE_NAMES, source) ? SOURCE_NAMES[source] : source;
}

export function formatStamp(value: string | null | undefined, lang: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(!lang || lang === 'en' ? 'en-GB' : lang, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function parsePresaleStreamMessage(data: string): PresaleStreamMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as { type?: unknown; registration?: unknown; summary?: unknown };
  if (message.type === 'notifications') return { type: 'notifications' };
  if (message.type === 'registration' && message.registration && message.summary) {
    return parsed as PresaleStreamMessage;
  }
  return null;
}
