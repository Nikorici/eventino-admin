import type { TableOffer, TableOfferBody, TablePayment } from '@/store/api/privateOffersApi';

import { findMockEvent } from './core';
import { bodyOf, mock, mockError, type MockHandler } from './mock';

const HOUR = 3_600_000;

const pending: TablePayment = {
  payment_status: 'PENDING',
  paid_at: null,
  paid_amount: null,
  paid_by_name: '',
  paid_by_email: '',
};

function paid(hoursAgo: number, amount: string, name: string, email: string): TablePayment {
  return {
    payment_status: 'PAID',
    paid_at: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    paid_amount: amount,
    paid_by_name: name,
    paid_by_email: email,
  };
}

function table(id: number, name: string, payerName: string, price: string, payment: TablePayment, hoursAgo: number): TableOffer {
  return {
    id,
    event: 4101,
    name,
    payer_name: payerName,
    price,
    currency: 'MDL',
    token: `tb-${id}-${(id * 7919).toString(36)}`,
    status: payment.payment_status === 'PAID' ? 'REDEEMED' : payment.payment_status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
    payment,
    created_at: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
  };
}

const tables: TableOffer[] = [
  table(4401, 'Table 1 · Terrace', 'Ion Rusu', '4500.00', paid(150, '4500.00', 'Ion Rusu', 'ion.rusu@gmail.com'), 220),
  table(4402, 'Table 2 · Lounge', 'Cristina Botnaru', '3200.00', pending, 120),
  table(4403, 'Table 3 · Stage front', '', '5000.00', pending, 96),
  table(4404, 'Table 4 · Garden', 'Mihai Ceban', '2800.00', paid(125, '2800.00', '', 'mihai.ceban@gmail.com'), 170),
  table(4405, 'Table 5 · Cellar', 'Irina Bivol', '3600.00', { ...pending, payment_status: 'CANCELLED' }, 260),
];

let nextId = 4500;

function replaceTable(id: number, patch: Partial<TableOffer>): TableOffer {
  const index = tables.findIndex((entry) => entry.id === id);
  tables[index] = { ...tables[index], ...patch };
  return tables[index];
}

function validate(body: Partial<TableOfferBody>): Record<string, string[]> | null {
  if (body.name !== undefined && !body.name.trim()) return { name: ['Table name is required.'] };
  if (body.price !== undefined && !(Number(body.price) > 0)) return { price: ['Price must be greater than zero.'] };
  return null;
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/table_offers/by-event/', ({ query }) =>
    tables.filter((entry) => entry.event === Number(query.event_id)),
  ),
  mock('POST', '/api/v1/table_offers/', (request) => {
    const body = bodyOf<TableOfferBody & { event: number }>(request);
    const event = findMockEvent(body.event ?? 0);
    if (!event) return mockError(400, { event: ['Invalid event.'] });
    const errors = validate({ name: body.name ?? '', price: body.price ?? '' });
    if (errors) return mockError(400, errors);
    nextId += 1;
    const created: TableOffer = {
      ...table(nextId, (body.name ?? '').trim(), (body.payer_name ?? '').trim(), Number(body.price).toFixed(2), pending, 0),
      event: event.id,
      currency: event.currency,
    };
    tables.unshift(created);
    return created;
  }),
  mock('PATCH', '/api/v1/table_offers/:id/', (request) => {
    const target = tables.find((entry) => entry.id === Number(request.params.id));
    if (!target) return mockError(404, { detail: 'Not found.' });
    if (target.payment?.payment_status === 'PAID') {
      return mockError(400, { non_field_errors: ['This table has been paid and can no longer be edited.'] });
    }
    if (target.status === 'CANCELLED') {
      return mockError(400, { non_field_errors: ['This table was cancelled and can no longer be edited.'] });
    }
    const body = bodyOf<TableOfferBody>(request);
    const errors = validate(body);
    if (errors) return mockError(400, errors);
    return replaceTable(target.id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.price !== undefined ? { price: Number(body.price).toFixed(2) } : {}),
      ...(body.payer_name !== undefined ? { payer_name: body.payer_name.trim() } : {}),
    });
  }),
  mock('POST', '/api/v1/table_offers/:id/cancel/', ({ params }) => {
    const target = tables.find((entry) => entry.id === Number(params.id));
    if (!target) return mockError(404, { detail: 'Not found.' });
    return replaceTable(target.id, { status: 'CANCELLED', payment: { ...pending, payment_status: 'CANCELLED' } });
  }),
];
