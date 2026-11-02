import type { SmartBillInvoiceRow, SmartBillInvoiceState } from '@/store/api/smartbillApi';

import { findMockEvent } from './core';
import { mock, mockError, type MockHandler } from './mock';

const SERIES = 'SE';

const TEMPLATE: { customer: string; total: number; state: SmartBillInvoiceState; number?: number; error?: string }[] = [
  { customer: 'Ana Popescu', total: 1800, state: 'sent', number: 148 },
  { customer: 'Ion Rusu', total: 500, state: 'sent', number: 147 },
  { customer: 'Maria Ciobanu', total: 300, state: 'pending' },
  { customer: 'Andrei Lungu', total: 250, state: 'failed', error: 'Client VAT code is not valid.' },
  { customer: 'Elena Cojocaru', total: 150, state: 'sent', number: 146 },
  { customer: '', total: 450, state: 'pending' },
  { customer: 'Victor Munteanu', total: 900, state: 'cancelled' },
  { customer: 'Cristina Botnaru', total: 1200, state: 'sent', number: 145 },
  { customer: 'Sergiu Țurcanu', total: 600, state: 'sent', number: 144 },
];

const CURRENCY_FACTOR: Record<string, number> = { MDL: 1, RON: 0.25, EUR: 0.05 };

const invoicesByEvent = new Map<number, SmartBillInvoiceRow[]>();
let lastNumber = 148;

function serial(value: number): string {
  return String(value).padStart(4, '0');
}

function invoicesOf(eventId: number): SmartBillInvoiceRow[] {
  const existing = invoicesByEvent.get(eventId);
  if (existing) return existing;
  const event = findMockEvent(eventId);
  const rows: SmartBillInvoiceRow[] =
    !event || event.inDraft || event.isCancelled
      ? []
      : TEMPLATE.map((entry, index) => ({
          order_id: eventId * 10 + 700 + index,
          customer: entry.customer,
          total: (entry.total * (CURRENCY_FACTOR[event.currency] ?? 1)).toFixed(2),
          currency: event.currency,
          state: entry.state,
          series: entry.number ? SERIES : '',
          number: entry.number ? serial(entry.number) : '',
          error_message: entry.error ?? '',
        }));
  invoicesByEvent.set(eventId, rows);
  return rows;
}

function findRow(orderId: number): SmartBillInvoiceRow | undefined {
  for (const rows of invoicesByEvent.values()) {
    const row = rows.find((item) => item.order_id === orderId);
    if (row) return row;
  }
  return undefined;
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/integrations/smartbill/invoices/', ({ query }) =>
    invoicesOf(Number(query.event_id)).map((row) => ({ ...row })),
  ),
  mock('POST', '/api/v1/integrations/smartbill/invoices/:orderId/send/', ({ params }) => {
    const row = findRow(Number(params.orderId));
    if (!row) return mockError(404, { error: 'Not found.' });
    if (row.state !== 'sent') {
      lastNumber += 1;
      row.state = 'sent';
      row.series = SERIES;
      row.number = serial(lastNumber);
      row.error_message = '';
    }
    return { state: row.state, series: row.series, number: row.number };
  }),
];
