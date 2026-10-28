import { baseApi } from './baseApi';

const smartbillBase = '/api/v1/integrations/smartbill';

const smartbillEndpoints = {
  connection: `${smartbillBase}/connection/`,
  testConnection: `${smartbillBase}/test-connection/`,
  invoices: `${smartbillBase}/invoices/`,
  send: (orderId: number) => `${smartbillBase}/invoices/${orderId}/send/`,
} as const;

export const smartbillDownloadEndpoint = {
  pdf: (orderId: number) => `${smartbillBase}/invoices/${orderId}/pdf/`,
} as const;

export type SmartBillInvoiceState = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface SmartBillConnection {
  configured: boolean;
  email: string;
  cif: string;
  series_name: string;
  auto_send: boolean;
  has_token: boolean;
  status: string;
  tax_name: string;
  tax_percentage: number;
}

export interface UpdateSmartBillConnectionBody {
  email: string;
  api_token?: string;
  cif: string;
  series_name: string;
  auto_send: boolean;
  tax_name?: string;
  tax_percentage?: number;
}

export interface SmartBillTestResult {
  ok: boolean;
  message: string;
}

export interface SmartBillInvoiceRow {
  order_id: number;
  customer: string;
  total: string;
  currency: string;
  state: SmartBillInvoiceState;
  series: string;
  number: string;
  error_message: string;
}

export interface SmartBillInvoiceActionResult {
  state?: SmartBillInvoiceState;
  series?: string;
  number?: string;
}

interface ErrorWithData {
  data?: { error?: unknown; message?: unknown; detail?: unknown };
}

function hasData(value: unknown): value is ErrorWithData {
  return typeof value === 'object' && value !== null;
}

export function smartbillErrorMessage(error: unknown): string | null {
  if (!hasData(error) || !error.data) return null;
  const candidate = error.data.error ?? error.data.message ?? error.data.detail;
  return typeof candidate === 'string' ? candidate : null;
}

export const smartbillApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['SmartBillConnection', 'SmartBillInvoices'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getSmartBillConnection: builder.query<SmartBillConnection, void>({
        query: () => smartbillEndpoints.connection,
        providesTags: ['SmartBillConnection'],
      }),
      updateSmartBillConnection: builder.mutation<SmartBillConnection, UpdateSmartBillConnectionBody>({
        query: (body) => ({
          url: smartbillEndpoints.connection,
          method: 'PUT',
          body,
        }),
        invalidatesTags: ['SmartBillConnection'],
      }),
      testSmartBillConnection: builder.mutation<SmartBillTestResult, void>({
        query: () => ({
          url: smartbillEndpoints.testConnection,
          method: 'POST',
          body: {},
        }),
      }),
      getSmartBillInvoices: builder.query<SmartBillInvoiceRow[], number>({
        query: (eventId) => `${smartbillEndpoints.invoices}?event_id=${eventId}`,
        transformResponse: (response: SmartBillInvoiceRow[] | { results?: SmartBillInvoiceRow[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: ['SmartBillInvoices'],
      }),
      sendSmartBillInvoice: builder.mutation<SmartBillInvoiceActionResult, number>({
        query: (orderId) => ({
          url: smartbillEndpoints.send(orderId),
          method: 'POST',
          body: {},
        }),
        invalidatesTags: ['SmartBillInvoices'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetSmartBillConnectionQuery,
  useUpdateSmartBillConnectionMutation,
  useTestSmartBillConnectionMutation,
  useGetSmartBillInvoicesQuery,
  useSendSmartBillInvoiceMutation,
} = smartbillApi;
