import type { Promoter, ReferralInterval, ReferralTimelinePoint } from '@/store/api/referralsApi';

import { bodyOf, mock, mockError, type MockHandler } from './mock';

interface MockPromoter extends Promoter {
  event: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function promoter(
  id: number,
  event: number,
  name: string,
  email: string | null,
  code: string,
  stats: { clicks: number; orders: number; revenue: number },
  isActive = true,
): MockPromoter {
  const createdAt = daysAgoIso(30 - id);
  return {
    id,
    event,
    name,
    email,
    phone: '',
    notes: '',
    is_active: isActive,
    created_at: createdAt,
    referral_link: { id: id + 500, code, is_active: isActive, created_at: createdAt },
    clicks: stats.clicks,
    orders: stats.orders,
    revenue: stats.revenue.toFixed(2),
    conversion_rate: stats.clicks > 0 ? (stats.orders / stats.clicks) * 100 : 0,
  };
}

const promoters: MockPromoter[] = [
  promoter(1, 4101, 'Ana Popescu', 'ana.popescu@gmail.com', 'k3xq9p', { clicks: 1240, orders: 162, revenue: 65340 }),
  promoter(2, 4101, 'Vinoteca Wine Bar', null, 'wq7_ze', { clicks: 860, orders: 84, revenue: 33180 }),
  promoter(3, 4101, 'Ion Rusu', 'ion.rusu@gmail.com', 'r2m8vd', { clicks: 732, orders: 41, revenue: 15990 }),
  promoter(4, 4101, 'Maria Ciobanu', 'maria.ciobanu@gmail.com', 'c-4ntb', { clicks: 415, orders: 52, revenue: 21060 }),
  promoter(
    5,
    4101,
    'Andrei Lungu',
    'andrei.lungu@gmail.com',
    'lu9fhx',
    { clicks: 128, orders: 6, revenue: 2250 },
    false,
  ),
  promoter(6, 4103, 'Radu Mureșan', 'radu.muresan@yahoo.ro', 'cj5mte', { clicks: 310, orders: 27, revenue: 3240 }),
  promoter(7, 4103, 'Club Form Space', null, 'fs82kq', { clicks: 145, orders: 9, revenue: 1080 }),
];

const POINT_COUNT: Record<ReferralInterval, number> = { daily: 14, weekly: 8, monthly: 6 };
const STEP_DAYS: Record<ReferralInterval, number> = { daily: 1, weekly: 7, monthly: 30 };

function promotersOf(eventId: number): MockPromoter[] {
  return promoters.filter((item) => item.event === eventId);
}

function timeline(eventId: number, interval: ReferralInterval): ReferralTimelinePoint[] {
  const list = promotersOf(eventId);
  if (list.length === 0) return [];
  const clicks = list.reduce((sum, item) => sum + item.clicks, 0);
  const orders = list.reduce((sum, item) => sum + item.orders, 0);
  const count = POINT_COUNT[interval];
  return Array.from({ length: count }, (_, index) => {
    const weight = 0.5 + ((index * 7) % 5) / 8 + index / count;
    const share = weight / (count * 1.2);
    return {
      date: daysAgoIso((count - 1 - index) * STEP_DAYS[interval]).slice(0, 10),
      clicks: Math.round(clicks * share),
      conversions: Math.round(orders * share),
    };
  });
}

function isInterval(value: string | undefined): value is ReferralInterval {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/referrals/promoters/', ({ query }) => promotersOf(Number(query.event_id))),
  mock('POST', '/api/v1/referrals/promoters/', (request) => {
    const body = bodyOf<{ event_id: number; name: string; notes: string }>(request);
    if (!body.name?.trim()) return mockError(400, { name: ['This field is required.'] });
    const id = Math.max(0, ...promoters.map((item) => item.id)) + 1;
    const created = promoter(id, Number(body.event_id), body.name.trim(), null, randomCode(), {
      clicks: 0,
      orders: 0,
      revenue: 0,
    });
    created.notes = body.notes ?? '';
    promoters.push(created);
    return created;
  }),
  mock('PATCH', '/api/v1/referrals/promoters/:id/', (request) => {
    const found = promoters.find((item) => item.id === Number(request.params.id));
    if (!found) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<{ is_active: boolean }>(request);
    if (typeof body.is_active === 'boolean') {
      found.is_active = body.is_active;
      if (found.referral_link) found.referral_link.is_active = body.is_active;
    }
    return found;
  }),
  mock('GET', '/api/v1/referrals/stats/timeline/', ({ query }) =>
    timeline(Number(query.event_id), isInterval(query.interval) ? query.interval : 'daily'),
  ),
  mock('GET', '/api/v1/referrals/stats/', ({ query }) => {
    const list = promotersOf(Number(query.event_id));
    const totalClicks = list.reduce((sum, item) => sum + item.clicks, 0);
    const orders = list.reduce((sum, item) => sum + item.orders, 0);
    return {
      active_promoters: list.filter((item) => item.is_active).length,
      total_clicks: totalClicks,
      attributed_orders: orders,
      referred_revenue: list.reduce((sum, item) => sum + Number(item.revenue), 0).toFixed(2),
      conversion_rate: totalClicks > 0 ? (orders / totalClicks) * 100 : 0,
    };
  }),
];
