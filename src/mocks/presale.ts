import type {
  PresaleNotificationStatus,
  PresaleOrganizerResponse,
  PresaleRegistrationRow,
  PresaleState,
  PresaleSummary,
} from '@/store/api/presaleApi';

import { findMockEvent } from './core';
import { mock, mockError, type MockRequest } from './mock';

const PAGE_SIZE = 25;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

const FIRST_NAMES = ['elena', 'mihai', 'irina', 'victor', 'ana', 'sergiu', 'cristina', 'andrei', 'diana', 'ion', 'natalia', 'alexandru', 'maria', 'dumitru', 'olga', 'vlad', 'tatiana', 'radu'];
const LAST_NAMES = ['cojocaru', 'ceban', 'bivol', 'munteanu', 'popescu', 'turcanu', 'rusu', 'lungu', 'rotaru', 'ursu', 'cebotari', 'moraru', 'sirbu', 'balan', 'gutu'];
const DOMAINS = ['gmail.com', 'gmail.com', 'mail.ru', 'yahoo.com', 'outlook.com'];

interface SourcePlan {
  source: string;
  weight: number;
  campaigns: string[];
  medium: string;
  referrer: string;
}

const SOURCES: SourcePlan[] = [
  { source: 'instagram', weight: 44, campaigns: ['toamna_presale', 'vin_story_sept', ''], medium: 'story', referrer: 'https://l.instagram.com/' },
  { source: 'facebook', weight: 25, campaigns: ['vin_story_sept', 'fb_lookalike', ''], medium: 'paid_social', referrer: 'https://m.facebook.com/' },
  { source: 'direct', weight: 16, campaigns: [''], medium: '', referrer: '' },
  { source: 'tiktok', weight: 9, campaigns: ['tiktok_degustare', ''], medium: 'video', referrer: 'https://www.tiktok.com/' },
  { source: 'google', weight: 4, campaigns: ['newsletter_sept', ''], medium: 'cpc', referrer: 'https://www.google.com/' },
  { source: 'telegram', weight: 2, campaigns: [''], medium: 'channel', referrer: 'https://t.me/' },
];

interface PresalePlan {
  state: PresaleState;
  startsInDays: number;
  publicSaleInDays: number;
  count: number;
  notified: boolean;
  seed: number;
}

const PLANS: Record<number, PresalePlan> = {
  4101: { state: 'PUBLIC_SALE', startsInDays: -9, publicSaleInDays: -2, count: 186, notified: true, seed: 4101 },
  4103: { state: 'PRE_SALE_REGISTRATION', startsInDays: 4, publicSaleInDays: 8, count: 37, notified: false, seed: 4103 },
};

function generator(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function pickSource(random: () => number): SourcePlan {
  let roll = random() * 100;
  for (const plan of SOURCES) {
    roll -= plan.weight;
    if (roll < 0) return plan;
  }
  return SOURCES[0];
}

function notificationStatus(notified: boolean, random: () => number): PresaleNotificationStatus {
  if (!notified) return 'PENDING';
  const roll = random();
  if (roll < 0.03) return 'FAILED';
  if (roll < 0.05) return 'SKIPPED';
  return 'SENT';
}

function buildRegistrations(eventId: number, plan: PresalePlan): PresaleRegistrationRow[] {
  const random = generator(plan.seed);
  const now = Date.now();
  const notifyAt = new Date(now + plan.startsInDays * DAY_MS).toISOString();
  return Array.from({ length: plan.count }, (_, index) => {
    const id = plan.seed * 1000 + plan.count - index;
    const first = pick(FIRST_NAMES, random);
    const last = pick(LAST_NAMES, random);
    const source = pickSource(random);
    const campaign = pick(source.campaigns, random);
    const hasPhone = random() < 0.7;
    const status = notificationStatus(plan.notified, random);
    const sent = status === 'SENT';
    const language = random() < 0.75 ? 'ro' : random() < 0.8 ? 'ru' : 'en';
    return {
      id,
      email: `${first}.${last}${index % 7 === 3 ? index : ''}@${pick(DOMAINS, random)}`,
      phone: hasPhone ? `+373 6${Math.floor(random() * 10)} ${String(100 + Math.floor(random() * 900))} ${String(100 + Math.floor(random() * 900))}` : '',
      language,
      traffic_source: source.source,
      utm_source: source.source === 'direct' ? '' : source.source,
      utm_medium: campaign ? source.medium : '',
      utm_campaign: campaign,
      utm_content: campaign ? pick(['teaser_video', 'carousel', 'line_up'], random) : '',
      utm_term: '',
      referrer: source.referrer,
      landing_url: `https://eventino.co/event/${eventId}${campaign ? `?utm_campaign=${campaign}` : ''}`,
      notification_status: status,
      has_account: random() < 0.58,
      registered_at: new Date(now - index * 5.3 * HOUR_MS - random() * HOUR_MS).toISOString(),
      notified_at: sent ? notifyAt : null,
      email_sent_at: sent ? notifyAt : null,
      sms_sent_at: sent && hasPhone ? new Date(now + plan.startsInDays * DAY_MS + 60000).toISOString() : null,
      push_sent_at: sent && random() < 0.4 ? notifyAt : null,
    };
  });
}

const registrationsByEvent = new Map<number, PresaleRegistrationRow[]>(
  Object.entries(PLANS).map(([eventId, plan]) => [Number(eventId), buildRegistrations(Number(eventId), plan)]),
);

function countBy(rows: PresaleRegistrationRow[], key: (row: PresaleRegistrationRow) => string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = key(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function summarize(rows: PresaleRegistrationRow[]): PresaleSummary {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const withAccount = rows.filter((row) => row.has_account).length;
  const notifications: Record<PresaleNotificationStatus, number> = { PENDING: 0, SENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
  rows.forEach((row) => {
    notifications[row.notification_status] += 1;
  });
  return {
    total: rows.length,
    today: rows.filter((row) => new Date(row.registered_at) >= startOfToday).length,
    with_phone: rows.filter((row) => row.phone).length,
    with_account: withAccount,
    new_leads: rows.length - withAccount,
    languages: countBy(rows, (row) => row.language).map(([language, count]) => ({ language, count })),
    sources: countBy(rows, (row) => row.traffic_source).map(([source, count]) => ({ source, count })),
    campaigns: countBy(rows, (row) => row.utm_campaign)
      .slice(0, 5)
      .map(([campaign, count]) => ({ campaign, count })),
    notifications,
  };
}

function page(rows: PresaleRegistrationRow[], query: MockRequest['query']) {
  const before = Number(query.before) || Infinity;
  const needle = (query.q ?? '').trim().toLowerCase();
  const matching = rows.filter(
    (row) =>
      row.id < before &&
      (!query.source || row.traffic_source === query.source) &&
      (!needle || row.email.toLowerCase().includes(needle) || row.phone.toLowerCase().includes(needle)),
  );
  const registrations = matching.slice(0, PAGE_SIZE);
  return {
    registrations,
    next_before: matching.length > PAGE_SIZE ? registrations[registrations.length - 1].id : null,
  };
}

function presaleOf(request: MockRequest) {
  const eventId = Number(request.params.id);
  const event = findMockEvent(eventId);
  const rows = registrationsByEvent.get(eventId);
  const plan = PLANS[eventId];
  if (!event || !rows || !plan) return null;
  return { eventId, event, rows, plan };
}

const notFound = () => mockError(404, { detail: 'Not found.' });

export const handlers = [
  mock('GET', '/api/v1/presale/events/:id/organizer/registrations/', (request) => {
    const found = presaleOf(request);
    return found ? page(found.rows, request.query) : notFound();
  }),
  mock('GET', '/api/v1/presale/events/:id/organizer/stream-token/', (request) =>
    presaleOf(request) ? { stream_token: `mock-presale-${request.params.id}`, expires_in: 60 } : notFound(),
  ),
  mock('GET', '/api/v1/presale/events/:id/organizer/', (request) => {
    const found = presaleOf(request);
    if (!found) return notFound();
    const { eventId, event, rows, plan } = found;
    const now = Date.now();
    const response: PresaleOrganizerResponse = {
      presale: {
        enabled: true,
        state: plan.state,
        starts_at: new Date(now + plan.startsInDays * DAY_MS).toISOString(),
        public_sale_starts_at: new Date(now + plan.publicSaleInDays * DAY_MS).toISOString(),
        live_notified_at: plan.notified ? new Date(now + plan.startsInDays * DAY_MS).toISOString() : null,
      },
      event: { id: eventId, title: event.name, starts_at: new Date(now + event.startOffset * DAY_MS).toISOString() },
      summary: summarize(rows),
      ...page(rows, {}),
    };
    return response;
  }),
];
