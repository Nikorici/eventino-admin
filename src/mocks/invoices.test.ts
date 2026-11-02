import type { SmartBillInvoiceRow } from '@/store/api/smartbillApi';

import { resolveMock, type MockOutcome } from './index';

function call(method: 'GET' | 'POST', path: string, query: Record<string, string> = {}) {
  return resolveMock({ method, path, query, body: {}, token: 'mock-access-1001' });
}

function dataOf<T>(outcome: MockOutcome): T {
  if ('error' in outcome) throw new Error(JSON.stringify(outcome.error));
  return outcome.data as T;
}

const LIST = '/api/v1/integrations/smartbill/invoices/';

describe('invoices mocks', () => {
  it('sends a pending SmartBill invoice and lists it as sent', async () => {
    const rows = dataOf<SmartBillInvoiceRow[]>(await call('GET', LIST, { event_id: '4101' }));
    const pending = rows.find((row) => row.state === 'pending');
    if (!pending) throw new Error('no pending row');
    Object.freeze(pending);
    const sent = dataOf<{ state: string; series: string; number: string }>(
      await call('POST', `${LIST}${pending.order_id}/send/`),
    );
    expect(sent.state).toBe('sent');
    const after = dataOf<SmartBillInvoiceRow[]>(await call('GET', LIST, { event_id: '4101' }));
    expect(after.find((row) => row.order_id === pending.order_id)).toMatchObject({ state: 'sent', series: 'SE' });
  });

  it('has no invoices for a cancelled event', async () => {
    expect(dataOf<SmartBillInvoiceRow[]>(await call('GET', LIST, { event_id: '4106' }))).toEqual([]);
  });
});
