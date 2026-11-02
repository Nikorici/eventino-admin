import type { CouponPayload, CreateCouponParams, EventCoupon } from '@/store/api/couponsApi';
import type { EventCoupon as StoredCoupon } from '@/types/api';

import { findMockEvent, mockEvents, type MockEvent } from './core';
import { bodyOf, isoDateTime, mock, mockError, type MockHandler } from './mock';

const DEFAULTS: Omit<EventCoupon, keyof StoredCoupon> = {
  valid_from: null,
  valid_until: null,
  ticket_types: [],
  limit_one_use_per_account: false,
  limit_one_use_per_ip: false,
};

const SEED_DETAILS: Record<number, Partial<EventCoupon>> = {
  901: { valid_from: isoDateTime(-13, '10:00:00'), valid_until: isoDateTime(1, '23:00:00') },
  902: { ticket_types: [51, 52], limit_one_use_per_account: true, limit_one_use_per_ip: true },
  903: { valid_from: isoDateTime(-90, '10:00:00'), valid_until: isoDateTime(-60, '23:59:00') },
};

const EXTRA_COUPONS: Record<number, EventCoupon[]> = {
  4101: [
    {
      id: 904,
      code: 'VIPVIN15',
      discount: 15,
      max_uses: 50,
      usage_count: 12,
      is_active: true,
      valid_from: null,
      valid_until: isoDateTime(1, '18:00:00'),
      ticket_types: [53],
      limit_one_use_per_account: true,
      limit_one_use_per_ip: false,
    },
    {
      id: 905,
      code: 'PRESA50',
      discount: 50,
      max_uses: 10,
      usage_count: 0,
      is_active: false,
      valid_from: null,
      valid_until: null,
      ticket_types: [],
      limit_one_use_per_account: true,
      limit_one_use_per_ip: false,
    },
  ],
};

const seededEvents = new Set<number>();
let nextCouponId = 2000;

function couponsOf(event: MockEvent): StoredCoupon[] {
  if (!seededEvents.has(event.id)) {
    seededEvents.add(event.id);
    saveCoupons(event, [...(event.detail?.coupons ?? []), ...(EXTRA_COUPONS[event.id] ?? [])]);
  }
  return event.detail?.coupons ?? [];
}

function saveCoupons(event: MockEvent, coupons: StoredCoupon[]): void {
  event.detail = { ...event.detail, coupons };
}

function present(coupon: StoredCoupon): EventCoupon {
  return { ...DEFAULTS, ...SEED_DETAILS[coupon.id], ...coupon };
}

function findCoupon(couponId: number): { event: MockEvent; coupons: StoredCoupon[]; coupon: StoredCoupon } | undefined {
  for (const event of mockEvents) {
    const coupons = couponsOf(event);
    const coupon = coupons.find((candidate) => candidate.id === couponId);
    if (coupon) return { event, coupons, coupon };
  }
  return undefined;
}

function invalid(coupons: StoredCoupon[], body: Partial<CouponPayload>, current?: StoredCoupon) {
  const code = body.code?.trim().toUpperCase();
  if (code && coupons.some((coupon) => coupon.id !== current?.id && coupon.code.toUpperCase() === code)) {
    return mockError(400, { code: ['Event coupon with this code already exists.'] });
  }
  if (current && body.max_uses && body.max_uses < current.usage_count) {
    return mockError(400, { max_uses: ['Usage limit cannot be lower than the current usage.'] });
  }
  return null;
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/event_coupons/by-event/', ({ query }) => {
    const event = findMockEvent(Number(query.event_id));
    return event ? couponsOf(event).map(present) : [];
  }),
  mock('POST', '/api/v1/event_coupons/', (request) => {
    const body = bodyOf<CreateCouponParams>(request);
    const event = findMockEvent(Number(body.event));
    if (!event) return mockError(400, { event: ['Invalid pk - object does not exist.'] });
    const coupons = couponsOf(event);
    const error = invalid(coupons, body);
    if (error) return error;
    const created: EventCoupon = {
      ...DEFAULTS,
      ...body,
      id: nextCouponId++,
      code: body.code?.trim() ?? '',
      discount: body.discount ?? 0,
      max_uses: body.max_uses ?? 0,
      is_active: body.is_active ?? true,
      usage_count: 0,
    };
    saveCoupons(event, [...coupons, created]);
    return created;
  }),
  mock('PATCH', '/api/v1/event_coupons/:id/', (request) => {
    const found = findCoupon(Number(request.params.id));
    if (!found) return mockError(404, { detail: 'Not found.' });
    const body = bodyOf<CouponPayload>(request);
    const error = invalid(found.coupons, body, found.coupon);
    if (error) return error;
    const updated = { ...present(found.coupon), ...body };
    saveCoupons(found.event, found.coupons.map((coupon) => (coupon.id === updated.id ? updated : coupon)));
    return updated;
  }),
  mock('DELETE', '/api/v1/event_coupons/:id/', ({ params }) => {
    const found = findCoupon(Number(params.id));
    if (!found) return mockError(404, { detail: 'Not found.' });
    if (found.coupon.usage_count > 0) {
      return mockError(400, { detail: 'This voucher has been used. Deactivate it instead of deleting.' });
    }
    saveCoupons(found.event, found.coupons.filter((coupon) => coupon.id !== found.coupon.id));
    return {};
  }),
];
