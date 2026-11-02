import type { SmartBillConnection, UpdateSmartBillConnectionBody } from '@/store/api/smartbillApi';

import { bodyOf, mock, mockError, type MockHandler } from './mock';

const SMARTBILL_SERIES = ['EVT', 'SBE'];

let connection: SmartBillConnection = {
  configured: true,
  email: 'andrei.ciobanu@sunsetevents.md',
  cif: 'RO41235870',
  series_name: 'EVT',
  auto_send: true,
  has_token: true,
  status: 'active',
  tax_name: 'Normala',
  tax_percentage: 21,
};

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/integrations/smartbill/connection/', () => connection),
  mock('PUT', '/api/v1/integrations/smartbill/connection/', (request) => {
    const body = bodyOf<UpdateSmartBillConnectionBody>(request);
    const missing = (['email', 'cif', 'series_name'] as const).filter((field) => !body[field]?.trim());
    if (missing.length > 0) {
      return mockError(400, Object.fromEntries(missing.map((field) => [field, ['This field is required.']])));
    }
    connection = {
      ...connection,
      configured: true,
      email: body.email?.trim() ?? '',
      cif: body.cif?.trim() ?? '',
      series_name: body.series_name?.trim() ?? '',
      auto_send: body.auto_send ?? false,
      tax_name: body.tax_name?.trim() || 'Normala',
      tax_percentage: body.tax_percentage ?? connection.tax_percentage,
      has_token: connection.has_token || Boolean(body.api_token?.trim()),
    };
    return connection;
  }),
  mock('POST', '/api/v1/integrations/smartbill/test-connection/', () => {
    if (!connection.configured || !connection.has_token) {
      return mockError(400, { ok: false, message: 'Save your SmartBill credentials first.' });
    }
    return SMARTBILL_SERIES.includes(connection.series_name.toUpperCase())
      ? { ok: true, message: 'Connection valid and series found.' }
      : { ok: false, message: 'Authenticated, but series not found in SmartBill.' };
  }),
];
