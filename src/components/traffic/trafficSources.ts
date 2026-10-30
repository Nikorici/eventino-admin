import type { BuyerCity } from '@/store/api/trackingApi';

export interface ReferrerInput {
  referrer: string | null;
  embedded_on?: string | null;
  total_clicks: number;
}

export interface GroupedSource {
  key: string;
  referrer: string;
  embedSite: string;
  totalClicks: number;
}

export function isDirectReferrer(referrer: string): boolean {
  return !referrer || referrer.trim().toLowerCase() === 'direct';
}

function hostFromUrl(value: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

function knownSource(lower: string): { key: string; name: string } | null {
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return { key: 'facebook.com', name: 'Facebook' };
  if (lower.includes('instagram.com')) return { key: 'instagram.com', name: 'Instagram' };
  if (lower.includes('t.me') || lower.includes('telegram')) return { key: 'telegram', name: 'Telegram' };
  if (lower.includes('twitter.com') || lower.includes('x.com')) return { key: 'twitter.com', name: 'Twitter / X' };
  if (lower.includes('linkedin.com')) return { key: 'linkedin.com', name: 'LinkedIn' };
  if (lower.includes('youtube.com')) return { key: 'youtube.com', name: 'YouTube' };
  if (lower.includes('eventino.co') || lower.includes('themyda.org')) return { key: 'eventino', name: 'Eventino' };
  return null;
}

function normalizeReferrer(referrer: string): string {
  if (isDirectReferrer(referrer)) return 'direct';
  const known = knownSource(referrer.toLowerCase());
  if (known) return known.key;
  return hostFromUrl(referrer)?.replace(/^(www\.|m\.|lm\.)/, '') ?? referrer;
}

function embedSiteOf(embeddedOn: string | null | undefined): string {
  if (!embeddedOn) return '';
  return hostFromUrl(embeddedOn)?.replace(/^www\./, '') ?? embeddedOn;
}

export function groupReferrers(referrers: ReferrerInput[]): GroupedSource[] {
  const grouped = new Map<string, GroupedSource>();
  for (const item of referrers) {
    const referrer = item.referrer ?? '';
    const embedSite = embedSiteOf(item.embedded_on);
    const key = `${normalizeReferrer(referrer)}|${embedSite}`;
    const existing = grouped.get(key);
    if (existing) existing.totalClicks += item.total_clicks;
    else grouped.set(key, { key, referrer, embedSite, totalClicks: item.total_clicks });
  }
  return [...grouped.values()].sort((a, b) => b.totalClicks - a.totalClicks);
}

export function sourceDisplayName(referrer: string, directLabel: string): string {
  if (isDirectReferrer(referrer)) return directLabel;
  const known = knownSource(referrer.toLowerCase());
  if (known) return known.name;
  const host = hostFromUrl(referrer);
  if (host) return host.replace(/^www\./, '');
  return referrer.length > 40 ? `${referrer.substring(0, 40)}...` : referrer;
}

export function sharePercent(clicks: number, total: number): number {
  if (!total) return 0;
  return Math.round((clicks / total) * 10000) / 100;
}

export interface Marker {
  key: string;
  label: string;
  x: number;
  y: number;
  r: number;
}

export function projectCities(cities: BuyerCity[], width: number, height: number, pad: number): Marker[] {
  if (cities.length === 0 || width <= 0) return [];
  const midLat = cities.reduce((sum, row) => sum + row.lat, 0) / cities.length;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const xs = cities.map((row) => row.lng * lngScale);
  const ys = cities.map((row) => -row.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(
    spanX > 0 ? (width - pad * 2) / spanX : Infinity,
    spanY > 0 ? (height - pad * 2) / spanY : Infinity,
  );
  const fitted = Number.isFinite(scale) ? scale : 0;
  const offsetX = (width - spanX * fitted) / 2;
  const offsetY = (height - spanY * fitted) / 2;
  const maxOrders = Math.max(...cities.map((row) => row.orders), 1);
  return cities.map((row, index) => ({
    key: `${row.city}|${row.country}`,
    label: row.city,
    x: offsetX + (xs[index] - minX) * fitted,
    y: offsetY + (ys[index] - minY) * fitted,
    r: 6 + 12 * Math.sqrt(row.orders / maxOrders),
  }));
}

export interface MapLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
}

export function placeLabels(markers: Marker[], width: number): MapLabel[] {
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  const labels: MapLabel[] = [];
  for (const marker of markers) {
    const textWidth = marker.label.length * 5.2;
    const candidates: ('start' | 'end')[] = marker.x < width * 0.6 ? ['start', 'end'] : ['end', 'start'];
    for (const anchor of candidates) {
      const x = anchor === 'start' ? marker.x + marker.r + 4 : marker.x - marker.r - 4;
      const box = {
        left: anchor === 'start' ? x : x - textWidth,
        right: anchor === 'start' ? x + textWidth : x,
        top: marker.y - 6,
        bottom: marker.y + 6,
      };
      const clashes = placed.some(
        (other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top,
      );
      if (clashes || box.left < 0 || box.right > width) continue;
      placed.push(box);
      labels.push({ key: marker.key, text: marker.label, x, y: marker.y + 3, anchor });
      break;
    }
  }
  return labels;
}
