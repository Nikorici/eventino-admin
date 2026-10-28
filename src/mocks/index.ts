import { handlers as auth } from './auth';
import { handlers as selectEvent } from './select-event';
import { handlers as dashboard } from './dashboard';
import { handlers as eventForm } from './event-form';
import { handlers as ticketScanners } from './ticket-scanners';
import { handlers as labelPrinting } from './label-printing';
import { handlers as ticketTypeSales } from './ticket-type-sales';
import { handlers as ticketInfo } from './ticket-info';
import { handlers as presale } from './presale';
import { handlers as scanStatistics } from './scan-statistics';
import { handlers as merch } from './merch';
import { handlers as trafficSources } from './traffic-sources';
import { handlers as referralTracking } from './referral-tracking';
import { handlers as marketingTracking } from './marketing-tracking';
import { handlers as formManagement } from './form-management';
import { handlers as staff } from './staff';
import { handlers as venuePricing } from './venue-pricing';
import { handlers as ticketTypes } from './ticket-types';
import { handlers as vouchers } from './vouchers';
import { handlers as privateOffers } from './private-offers';
import { handlers as tables } from './tables';
import { handlers as invoices } from './invoices';
import { handlers as overview } from './overview';
import { handlers as adminEvents } from './admin-events';
import { handlers as fiscalizare } from './fiscalizare';
import { handlers as labelPrinters } from './label-printers';
import { handlers as stickers } from './stickers';
import { handlers as smartbill } from './smartbill';
import { handlers as team } from './team';
import { handlers as profileTraffic } from './profile-traffic';
import { handlers as messageSubscribers } from './message-subscribers';
import { handlers as companyInfo } from './company-info';
import { handlers as settings } from './settings';
import { handlers as core } from './core';
import { matchHandler, MockError, type MockHandler, type MockMethod } from './mock';

export const mockHandlers: MockHandler[] = [
  ...auth,
  ...selectEvent,
  ...dashboard,
  ...eventForm,
  ...ticketScanners,
  ...labelPrinting,
  ...ticketTypeSales,
  ...ticketInfo,
  ...presale,
  ...scanStatistics,
  ...merch,
  ...trafficSources,
  ...referralTracking,
  ...marketingTracking,
  ...formManagement,
  ...staff,
  ...venuePricing,
  ...ticketTypes,
  ...vouchers,
  ...privateOffers,
  ...tables,
  ...invoices,
  ...overview,
  ...adminEvents,
  ...fiscalizare,
  ...labelPrinters,
  ...stickers,
  ...smartbill,
  ...team,
  ...profileTraffic,
  ...messageSubscribers,
  ...companyInfo,
  ...settings,
  ...core,
];

export interface MockCall {
  method: MockMethod;
  path: string;
  query: Record<string, string>;
  body: unknown;
  token: string | null;
}

export type MockOutcome = { data: unknown } | { error: { status: number; data: unknown } };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveMock(call: MockCall): Promise<MockOutcome> {
  const found = matchHandler(mockHandlers, call.method, call.path);
  if (!found) {
    console.warn(`[mocks] No handler for ${call.method} ${call.path}`);
    return { error: { status: 404, data: { detail: `No mock for ${call.method} ${call.path}` } } };
  }
  await wait(found.handler.delay);
  try {
    const result = found.handler.resolve({ ...call, params: found.params });
    if (result instanceof MockError) return { error: { status: result.status, data: result.data } };
    return { data: result ?? null };
  } catch (error) {
    return { error: { status: 500, data: { detail: error instanceof Error ? error.message : 'Mock handler failed' } } };
  }
}
