import { privateOfferEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

export type PrivateOfferStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'REDEEMED' | string;

export interface PrivateOfferItem {
  ticket_type: number;
  ticket_type_name: string;
  ticket_type_price: string;
  quantity: number;
}

export interface PrivateOfferInstallment {
  due_date: string;
  amount: string;
}

export interface InstallmentPlanRow {
  sequence: number;
  amount: string;
  due_date: string;
  status: string;
  paid_at?: string | null;
}

export interface InstallmentPlan {
  order_id: number;
  status: string;
  total_amount: string;
  paid_amount: string;
  installments: InstallmentPlanRow[];
  next_due: InstallmentPlanRow | null;
}

export interface PrivateOffer {
  id: number;
  event: number;
  name: string;
  recipient_email: string;
  message: string;
  token: string;
  pricing_mode: string;
  custom_total_price: string;
  resolved_price: string;
  currency: string;
  expires_at: string | null;
  max_redemptions: number;
  status: PrivateOfferStatus;
  effective_status: PrivateOfferStatus;
  view_count: number;
  redemptions_used: number;
  items: PrivateOfferItem[];
  installments: PrivateOfferInstallment[];
  installment_plan: InstallmentPlan | null;
  created_at: string;
}

export interface PublicPrivateOffer {
  name: string;
  message: string;
  resolved_price: string;
  currency: string;
  event: number;
  event_title: string;
  expires_at: string | null;
  effective_status: PrivateOfferStatus;
  items: PrivateOfferItem[];
  installments: PrivateOfferInstallment[];
  installment_plan: InstallmentPlan | null;
}

export interface CreatePrivateOfferBody {
  event: number;
  name: string;
  recipient_email: string;
  message: string;
  pricing_mode: 'FIXED_TOTAL';
  custom_total_price: string;
  max_redemptions: number;
  items: { ticket_type: number; quantity: number }[];
  installments?: PrivateOfferInstallment[];
}

export interface OfferQuote {
  client_total?: string;
  [key: string]: unknown;
}

export interface InstallmentEmailResult {
  sent: boolean;
  type: 'intro' | 'reminder';
  sequence?: number;
}

export type TablePaymentStatus = 'PAID' | 'PENDING' | 'CANCELLED';

export interface TablePayment {
  payment_status: TablePaymentStatus;
  paid_at: string | null;
  paid_amount: string | null;
  paid_by_name: string;
  paid_by_email: string;
}

export interface TableOffer {
  id: number;
  event: number;
  name: string;
  payer_name: string;
  price: string;
  currency: string;
  token: string;
  status: PrivateOfferStatus;
  payment: TablePayment | null;
  created_at: string;
}

export interface TableOfferBody {
  name: string;
  price: string;
  payer_name: string;
}

const tableOfferEndpoint = {
  list: '/api/v1/table_offers/',
  byEvent: (eventId: number) => `/api/v1/table_offers/by-event/?event_id=${eventId}`,
  detail: (tableId: number) => `/api/v1/table_offers/${tableId}/`,
  cancel: (tableId: number) => `/api/v1/table_offers/${tableId}/cancel/`,
} as const;

function toList<T>(response: T[] | { results?: T[] }): T[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const privateOffersApi = baseApi.enhanceEndpoints({ addTagTypes: ['PrivateOffers', 'TableOffers'] }).injectEndpoints({
  endpoints: (builder) => ({
    getEventOffers: builder.query<PrivateOffer[], number>({
      query: (eventId) => privateOfferEndpoint.byEvent(eventId),
      transformResponse: (response: PrivateOffer[] | { results?: PrivateOffer[] }) => toList(response),
      providesTags: (_result, _error, eventId) => [{ type: 'PrivateOffers', id: eventId }],
    }),
    createOffer: builder.mutation<PrivateOffer, CreatePrivateOfferBody>({
      query: (body) => ({ url: privateOfferEndpoint.list, method: 'POST', body }),
      invalidatesTags: (_result, _error, { event }) => [{ type: 'PrivateOffers', id: event }],
    }),
    cancelOffer: builder.mutation<PrivateOffer, { offerId: number; eventId: number }>({
      query: ({ offerId }) => ({ url: privateOfferEndpoint.cancel(offerId), method: 'POST' }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'PrivateOffers', id: eventId }],
    }),
    sendInstallmentEmail: builder.mutation<InstallmentEmailResult, { offerId: number }>({
      query: ({ offerId }) => ({ url: privateOfferEndpoint.sendInstallmentEmail(offerId), method: 'POST' }),
    }),
    getOfferQuote: builder.query<OfferQuote, { eventId: number; amount: string }>({
      query: ({ eventId, amount }) => privateOfferEndpoint.quote(eventId, amount),
      keepUnusedDataFor: 0,
    }),
    getOfferByToken: builder.query<PublicPrivateOffer, string>({
      query: (token) => privateOfferEndpoint.byToken(token),
      keepUnusedDataFor: 0,
    }),
    payInstallment: builder.mutation<{ checkout_url?: string | null }, { offer_token: string }>({
      query: (body) => ({ url: privateOfferEndpoint.payInstallment, method: 'POST', body }),
    }),
    getEventTables: builder.query<TableOffer[], number>({
      query: (eventId) => tableOfferEndpoint.byEvent(eventId),
      transformResponse: (response: TableOffer[] | { results?: TableOffer[] }) => toList(response),
      providesTags: (_result, _error, eventId) => [{ type: 'TableOffers', id: eventId }],
    }),
    createTable: builder.mutation<TableOffer, TableOfferBody & { event: number }>({
      query: (body) => ({ url: tableOfferEndpoint.list, method: 'POST', body }),
      invalidatesTags: (_result, _error, { event }) => [{ type: 'TableOffers', id: event }],
    }),
    updateTable: builder.mutation<TableOffer, { tableId: number; eventId: number; body: TableOfferBody }>({
      query: ({ tableId, body }) => ({ url: tableOfferEndpoint.detail(tableId), method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'TableOffers', id: eventId }],
    }),
    cancelTable: builder.mutation<TableOffer, { tableId: number; eventId: number }>({
      query: ({ tableId }) => ({ url: tableOfferEndpoint.cancel(tableId), method: 'POST' }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'TableOffers', id: eventId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEventOffersQuery,
  useCreateOfferMutation,
  useCancelOfferMutation,
  useSendInstallmentEmailMutation,
  useLazyGetOfferQuoteQuery,
  useGetOfferByTokenQuery,
  usePayInstallmentMutation,
  useGetEventTablesQuery,
  useCreateTableMutation,
  useUpdateTableMutation,
  useCancelTableMutation,
} = privateOffersApi;
