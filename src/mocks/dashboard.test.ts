import { resolveMock, type MockOutcome } from './index';

function call(method: 'GET' | 'POST', path: string, body: unknown = undefined, query: Record<string, string> = {}) {
  return resolveMock({ method, path, query, body, token: 'mock-access-1001' });
}

function dataOf<T>(outcome: MockOutcome): T {
  if ('error' in outcome) throw new Error(JSON.stringify(outcome.error));
  return outcome.data as T;
}

describe('dashboard mocks', () => {
  it('pages buyers and filters by attendance', async () => {
    const first = dataOf<{ results: unknown[]; total_count: number; has_next: boolean }>(
      await call('POST', '/api/v1/statistics/get-buyers-list/', { event_id: 4101, page: 1, page_size: 20 }),
    );
    expect(first.results).toHaveLength(20);
    expect(first.total_count).toBe(46);
    expect(first.has_next).toBe(true);
    const scanned = dataOf<{ results: { scanned_count: number }[] }>(
      await call('POST', '/api/v1/statistics/get-buyers-list/', { event_id: 4101, page: 1, page_size: 100, is_scanned: true }),
    );
    expect(scanned.results.every((row) => row.scanned_count > 0)).toBe(true);
  });

  it('moves a paid invoice order out of pending and into bank transfers', async () => {
    const pending = dataOf<{ id: number; payment_method: string }[]>(
      await call('GET', '/api/v1/tickets/pending-orders/', undefined, { event_id: '4101' }),
    );
    const invoice = pending.find((order) => order.payment_method === 'INVOICE');
    expect(invoice).toBeDefined();
    const result = dataOf<{ factura_sent: boolean }>(
      await call('POST', '/api/v1/tickets/mark-invoice-as-paid/', { order_id: invoice?.id }),
    );
    expect(result.factura_sent).toBe(true);
    const after = dataOf<{ id: number }[]>(await call('GET', '/api/v1/tickets/pending-orders/', undefined, { event_id: '4101' }));
    expect(after.some((order) => order.id === invoice?.id)).toBe(false);
    const bank = dataOf<{ id: number }[]>(
      await call('GET', '/api/v1/tickets/factura-orders/', undefined, { event_id: '4101', customer_type: 'all' }),
    );
    expect(bank[0].id).toBe(invoice?.id);
  });

  it('removes a free ticket request once it is sent', async () => {
    const requests = dataOf<{ id: number }[]>(
      await call('GET', '/api/v1/tickets/free-ticket-requests/', undefined, { event_id: '4101' }),
    );
    await call('POST', '/api/v1/tickets/send-free-ticket/', { order_id: requests[0].id });
    const after = dataOf<{ id: number }[]>(
      await call('GET', '/api/v1/tickets/free-ticket-requests/', undefined, { event_id: '4101' }),
    );
    expect(after).toHaveLength(requests.length - 1);
  });

  it('renumbers an online legal-entity invoice', async () => {
    const before = dataOf<{ id: number }[]>(
      await call('GET', '/api/v1/tickets/factura-individual-orders/', undefined, { event_id: '4101', customer_type: 'juridice' }),
    );
    const result = dataOf<{ invoice_serial: string; invoice_serial_number: number }>(
      await call('POST', '/api/v1/tickets/edit-invoice-serial/', { order_id: before[0].id, invoice_serial_number: 7 }),
    );
    expect(result).toMatchObject({ invoice_serial: 'EVN-0007', invoice_serial_number: 7 });
  });

  it('keeps per-event stats in the event currency', async () => {
    const stats = dataOf<{ all_time: { income_by_currency: Record<string, number> }; event_currencies: string[] }>(
      await call('POST', '/api/v1/statistics/get-recent-stats/', { time_interval: 'all_time', event_id: 4103 }),
    );
    expect(stats.event_currencies).toEqual(['RON']);
    expect(Object.keys(stats.all_time.income_by_currency)).toEqual(['RON']);
  });
});
