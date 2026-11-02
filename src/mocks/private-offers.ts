import type {
  CreatePrivateOfferBody,
  InstallmentPlan,
  PrivateOffer,
  PrivateOfferInstallment,
  PrivateOfferItem,
} from '@/store/api/privateOffersApi';

import { findMockEvent } from './core';
import { bodyOf, mock, mockError, type MockHandler } from './mock';

const DAY = 86_400_000;

function dayOffset(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

function item(ticketType: number, name: string, price: string, quantity: number): PrivateOfferItem {
  return { ticket_type: ticketType, ticket_type_name: name, ticket_type_price: price, quantity };
}

function plan(orderId: number, total: string, rows: { days: number; amount: string; paid: boolean }[]): InstallmentPlan {
  const installments = rows.map((row, index) => ({
    sequence: index + 1,
    amount: row.amount,
    due_date: dayOffset(row.days),
    status: row.paid ? 'PAID' : 'PENDING',
    paid_at: row.paid ? new Date(Date.now() + row.days * DAY).toISOString() : null,
  }));
  const paidAmount = installments
    .filter((row) => row.status === 'PAID')
    .reduce((sum, row) => sum + Number(row.amount), 0)
    .toFixed(2);
  return {
    order_id: orderId,
    status: paidAmount === total ? 'PAID' : 'ACTIVE',
    total_amount: total,
    paid_amount: paidAmount,
    installments,
    next_due: installments.find((row) => row.status !== 'PAID') ?? null,
  };
}

function schedule(rows: { days: number; amount: string }[]): PrivateOfferInstallment[] {
  return rows.map((row) => ({ due_date: dayOffset(row.days), amount: row.amount }));
}

function offer(values: Partial<PrivateOffer> & Pick<PrivateOffer, 'id' | 'name' | 'recipient_email' | 'resolved_price'>): PrivateOffer {
  return {
    event: 4101,
    message: '',
    token: `po${values.id}x${(values.id * 7919).toString(36)}`,
    pricing_mode: 'FIXED_TOTAL',
    custom_total_price: values.resolved_price,
    currency: 'MDL',
    expires_at: null,
    max_redemptions: 1,
    status: 'ACTIVE',
    effective_status: 'ACTIVE',
    view_count: 0,
    redemptions_used: 0,
    items: [],
    installments: [],
    installment_plan: null,
    created_at: new Date(Date.now() - 10 * DAY).toISOString(),
    ...values,
  };
}

const offers: PrivateOffer[] = [
  offer({
    id: 3101,
    name: 'VIP Lounge, Popescu group',
    recipient_email: 'ana.popescu@gmail.com',
    message: 'Masa voastră VIP pentru 10 persoane, cu plata în trei rate.',
    resolved_price: '9450.00',
    view_count: 6,
    items: [item(53, 'VIP Lounge', '900.00', 10)],
    installments: schedule([
      { days: -20, amount: '3150.00' },
      { days: -5, amount: '3150.00' },
      { days: 3, amount: '3150.00' },
    ]),
    installment_plan: plan(88101, '9450.00', [
      { days: -20, amount: '3150.00', paid: true },
      { days: -5, amount: '3150.00', paid: true },
      { days: 3, amount: '3150.00', paid: false },
    ]),
    created_at: new Date(Date.now() - 24 * DAY).toISOString(),
  }),
  offer({
    id: 3102,
    name: '2-day passes, Rusu family',
    recipient_email: 'ion.rusu@gmail.com',
    resolved_price: '1575.00',
    view_count: 1,
    items: [item(52, 'Abonament 2 zile', '250.00', 6)],
    installments: schedule([
      { days: 2, amount: '525.00' },
      { days: 9, amount: '525.00' },
      { days: 16, amount: '525.00' },
    ]),
    created_at: new Date(Date.now() - 2 * DAY).toISOString(),
  }),
  offer({
    id: 3103,
    name: 'Lounge for two, Munteanu',
    recipient_email: 'victor.munteanu@gmail.com',
    resolved_price: '1890.00',
    status: 'REDEEMED',
    effective_status: 'REDEEMED',
    view_count: 4,
    redemptions_used: 1,
    items: [item(53, 'VIP Lounge', '900.00', 2)],
    installments: schedule([
      { days: -30, amount: '630.00' },
      { days: -18, amount: '630.00' },
      { days: -6, amount: '630.00' },
    ]),
    installment_plan: plan(88102, '1890.00', [
      { days: -30, amount: '630.00', paid: true },
      { days: -18, amount: '630.00', paid: true },
      { days: -6, amount: '630.00', paid: true },
    ]),
    created_at: new Date(Date.now() - 32 * DAY).toISOString(),
  }),
  offer({
    id: 3104,
    name: 'Team tasting, Cojocaru',
    recipient_email: 'elena.cojocaru@gmail.com',
    resolved_price: '2625.00',
    status: 'CANCELLED',
    effective_status: 'CANCELLED',
    items: [item(52, 'Abonament 2 zile', '250.00', 10)],
    installments: schedule([
      { days: -4, amount: '1312.50' },
      { days: 10, amount: '1312.50' },
    ]),
    created_at: new Date(Date.now() - 15 * DAY).toISOString(),
  }),
  offer({
    id: 3105,
    name: 'Day passes for Andrei Lungu',
    recipient_email: 'andrei.lungu@gmail.com',
    resolved_price: '315.00',
    effective_status: 'EXPIRED',
    expires_at: new Date(Date.now() - 3 * DAY).toISOString(),
    items: [item(51, 'Acces o zi', '150.00', 2)],
    created_at: new Date(Date.now() - 40 * DAY).toISOString(),
  }),
];

let nextId = 3200;

function replaceOffer(id: number, patch: Partial<PrivateOffer>): PrivateOffer | null {
  const index = offers.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  offers[index] = { ...offers[index], ...patch };
  return offers[index];
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/private_offers/by-event/', ({ query }) =>
    offers.filter((entry) => entry.event === Number(query.event_id)),
  ),
  mock('GET', '/api/v1/private_offers/quote/', ({ query }) => {
    const base = Number(query.amount);
    if (!base || base <= 0) return mockError(400, { detail: 'amount must be positive.' });
    const total = Math.round(base * 105) / 100;
    return {
      base_amount: base.toFixed(2),
      fee_percent: 5,
      fee_with_vat: (total - base).toFixed(2),
      client_total: total.toFixed(2),
    };
  }),
  mock('POST', '/api/v1/private_offers/', (request) => {
    const body = bodyOf<CreatePrivateOfferBody>(request);
    const event = findMockEvent(body.event ?? 0);
    if (!event) return mockError(400, { event: ['Invalid event.'] });
    nextId += 1;
    const items = (body.items ?? []).map((entry) => {
      const type = event.ticketTypes.find((candidate) => candidate.id === entry.ticket_type);
      return item(entry.ticket_type, type?.name ?? `#${entry.ticket_type}`, (type?.price ?? 0).toFixed(2), entry.quantity);
    });
    const created = offer({
      id: nextId,
      event: event.id,
      name: body.name ?? '',
      recipient_email: body.recipient_email ?? '',
      message: body.message ?? '',
      resolved_price: body.custom_total_price ?? '0.00',
      currency: event.currency,
      items,
      installments: body.installments ?? [],
      created_at: new Date().toISOString(),
    });
    offers.unshift(created);
    return created;
  }),
  mock('POST', '/api/v1/private_offers/:id/cancel/', ({ params }) => {
    const updated = replaceOffer(Number(params.id), { status: 'CANCELLED', effective_status: 'CANCELLED' });
    return updated ?? mockError(404, { detail: 'Not found.' });
  }),
  mock('POST', '/api/v1/private_offers/:id/send-installment-email/', ({ params }) => {
    const target = offers.find((entry) => entry.id === Number(params.id));
    if (!target) return mockError(404, { detail: 'Not found.' });
    if (target.installment_plan) {
      return { sent: true, type: 'reminder', sequence: target.installment_plan.next_due?.sequence };
    }
    return { sent: true, type: 'intro' };
  }),
];
