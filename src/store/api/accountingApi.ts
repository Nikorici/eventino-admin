import { accountingEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

export type AccountingPaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type TransferStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export const ACCOUNTING_PAYMENT_STATUSES: AccountingPaymentStatus[] = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
export const TRANSFER_STATUSES: TransferStatus[] = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'];

export interface AccountingCompany {
  id: number;
  name: string | null;
  cui: string | null;
  registration_number: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  postal_code: string | null;
  country_code: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  pays_tva?: boolean;
  tva_percent?: string | number | null;
}

export interface EventTransfer {
  id: number;
  payment_number: number | null;
  amount: string;
  currency: string;
  transfer_date: string | null;
  recipient_name: string;
  recipient_iban: string;
  reference: string;
  status: TransferStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EventAccounting {
  id: number;
  event: number;
  event_title: string;
  event_currency: string;
  event_country: string;
  event_start_date: string | null;
  event_end_date: string | null;
  owner_name: string | null;
  has_vat: boolean;
  vat_percent: string | number;
  has_tax: boolean;
  tax_percent: string | number;
  gross_total: string | number;
  vat_amount: string | number;
  tax_amount: string | number;
  platform_fee: string | number;
  net_to_organizer: string | number;
  currency: string;
  payment_status: AccountingPaymentStatus;
  case_closed: boolean;
  notes: string;
  recipient_name: string;
  recipient_iban: string;
  recipient_company: number | null;
  company: AccountingCompany | null;
  transfers: EventTransfer[];
  paid_total: string | number;
  remaining_amount: string | number;
  tickets_income: string | number;
  tickets_sold: number;
  total_received: string | number;
  commission_paid_by: string | null;
  commission_percent: string | number | null;
  commission_amount: string | number;
  buyer_fee_percent: string | number;
  buyer_fee_vat_percent: string | number;
  buyer_fee_net: string | number;
  buyer_fee_vat: string | number;
  buyer_fee_total: string | number;
  tickets_total: string | number;
  collected_total: string | number;
  eventino_income: string | number;
  settlement_currency: string | null;
  settlement_gross: string | number;
  settlement_base: string | number;
  settlement_commission: string | number;
  settlement_net: string | number;
  settlement_paid: string | number;
  settlement_remaining: string | number;
  settlement_fx_rate: string | number;
  settlement_orders_count: number;
  unsettled_total: string | number;
  unsettled_currency: string | null;
  unsettled_orders_count: number;
}

export interface AccountingSettingsPatch {
  has_vat: boolean;
  vat_percent: number;
  has_tax: boolean;
  tax_percent: number;
  payment_status: AccountingPaymentStatus;
  case_closed: boolean;
  notes: string;
  recipient_name: string;
  recipient_iban: string;
}

export interface TransferBody {
  payment_number?: number;
  amount: number;
  currency: string;
  transfer_date: string | null;
  recipient_name: string;
  recipient_iban: string;
  reference: string;
  status: TransferStatus;
  notes: string;
}

export const accountingApi = baseApi.enhanceEndpoints({ addTagTypes: ['Accounting'] }).injectEndpoints({
  endpoints: (builder) => ({
    getEventAccounting: builder.query<EventAccounting, number>({
      query: (eventId) => accountingEndpoint.event(eventId),
      providesTags: (_result, _error, eventId) => [{ type: 'Accounting', id: eventId }],
    }),
    updateEventAccounting: builder.mutation<EventAccounting, { eventId: number; patch: AccountingSettingsPatch }>({
      query: ({ eventId, patch }) => ({ url: accountingEndpoint.event(eventId), method: 'PATCH', body: patch }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Accounting', id: eventId }],
    }),
    createEventTransfer: builder.mutation<EventTransfer, { eventId: number; body: TransferBody }>({
      query: ({ eventId, body }) => ({ url: accountingEndpoint.transfers(eventId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Accounting', id: eventId }],
    }),
    updateEventTransfer: builder.mutation<EventTransfer, { eventId: number; transferId: number; body: Partial<TransferBody> }>({
      query: ({ eventId, transferId, body }) => ({ url: accountingEndpoint.transfer(eventId, transferId), method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Accounting', id: eventId }],
    }),
    deleteEventTransfer: builder.mutation<unknown, { eventId: number; transferId: number }>({
      query: ({ eventId, transferId }) => ({ url: accountingEndpoint.transfer(eventId, transferId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Accounting', id: eventId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEventAccountingQuery,
  useUpdateEventAccountingMutation,
  useCreateEventTransferMutation,
  useUpdateEventTransferMutation,
  useDeleteEventTransferMutation,
} = accountingApi;
