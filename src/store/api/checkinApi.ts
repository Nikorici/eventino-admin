import { checkinEndpoint } from '@/lib/constants';
import type { MultipartFile } from '@/lib/eventFormBody';
import type { RefundRequestState } from '@/types/api';

import { baseApi } from './baseApi';

export type CheckInStatus = 'NONE' | 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface CheckInState {
  status: CheckInStatus;
  full_name: string | null;
  date_of_birth?: string | null;
  age?: number | null;
  is_minor?: boolean | null;
  has_selfie: boolean;
  selfie_url: string | null;
  submitted_at?: string | null;
  editable: boolean;
}

export type WalletEntryKind = 'TOPUP' | 'TRANSFER_OUT' | 'TRANSFER_REVERSAL' | 'ADJUSTMENT';

export interface WalletEntry {
  kind: WalletEntryKind | string;
  amount_minor: number;
  balance_after_minor?: number;
  created_at: string;
}

export interface BraceletState {
  linked: boolean;
  conpay_card_id: string | null;
  status: string | null;
}

export interface WalletState {
  currency: string;
  balance_minor: number;
  pending_amount_minor: number;
  topped_up_minor: number;
  transferred_minor: number;
  min_topup_minor: number;
  max_topup_minor: number;
  entries?: WalletEntry[];
  bracelet?: BraceletState;
}

export interface CheckInEventInfo {
  id: number;
  title: string;
  slug?: string;
  start_date: string;
  end_date?: string | null;
  currency: string;
  image: string | null;
  checkin_required: boolean;
  wallet_topup_enabled: boolean;
  bracelet_linking_enabled?: boolean;
  allow_self_service_refunds?: boolean;
  age_reference?: string | null;
}

export interface TicketCheckInDetails {
  ticket: { id: number; uuid: string; ticket_type: string; display_name: string | null; scanned: boolean };
  event: CheckInEventInfo;
  checkin: CheckInState;
  wallet: WalletState;
  bracelet: BraceletState;
}

export interface AccountTicket {
  id: number;
  uuid: string;
  ticket_type: string;
  display_name: string | null;
  entered: boolean;
  scan_date: string | null;
  order: { id: number; payment_status: string | null; refund_request: RefundRequestState | null };
  event: CheckInEventInfo;
  checkin: CheckInState;
  checkin_token: string | null;
  wallet: WalletState;
  bracelet: BraceletState;
}

export interface AccountTicketTotals {
  ticket_count: number;
  balance_minor: number;
  pending_amount_minor: number;
  awaiting_checkin: number;
  currency: string;
}

export interface AccountTicketsResponse {
  tickets: AccountTicket[];
  totals: AccountTicketTotals;
}

export interface CheckInSubmitBody {
  ticketId: number;
  fullName: string;
  dateOfBirth: string;
  selfie?: MultipartFile | null;
}

export interface CheckInSubmitResponse {
  updated: boolean;
  checkin: CheckInState;
}

export type TopUpProvider = 'maib' | 'mia';

export interface TopUpBody {
  ticketId: number;
  provider: TopUpProvider;
  amountMinor: number;
}

export interface TopUpResponse {
  topup_id: number;
  checkout_url: string;
  qr_code?: string;
}

interface NativeFormData {
  append(name: string, value: string | MultipartFile): void;
}

function buildCheckInForm({ fullName, dateOfBirth, selfie }: CheckInSubmitBody): FormData {
  const form = new FormData() as unknown as NativeFormData;
  form.append('full_name', fullName);
  form.append('date_of_birth', dateOfBirth);
  if (selfie) form.append('selfie', selfie);
  return form as unknown as FormData;
}

export const checkinApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['CheckIn', 'Wallet', 'AccountTickets'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMyTicketCheckIn: builder.query<TicketCheckInDetails, number | string>({
        query: (ticketId) => checkinEndpoint.ticket(ticketId),
        providesTags: (_result, _error, ticketId) => [{ type: 'CheckIn', id: ticketId }],
      }),
      submitMyTicketCheckIn: builder.mutation<CheckInSubmitResponse, CheckInSubmitBody>({
        query: (body) => ({ url: checkinEndpoint.submit(body.ticketId), method: 'POST', body: buildCheckInForm(body) }),
        invalidatesTags: (_result, _error, { ticketId }) => [{ type: 'CheckIn', id: ticketId }, 'AccountTickets'],
      }),
      getMyTicketWallet: builder.query<WalletState, number | string>({
        query: (ticketId) => checkinEndpoint.wallet(ticketId),
        providesTags: (_result, _error, ticketId) => [{ type: 'Wallet', id: ticketId }],
      }),
      initiateMyTicketTopUp: builder.mutation<TopUpResponse, TopUpBody>({
        query: ({ ticketId, provider, amountMinor }) => ({
          url: checkinEndpoint.topUp(ticketId, provider),
          method: 'POST',
          body: { amount_minor: Math.round(amountMinor) },
        }),
      }),
      getMyAccountTickets: builder.query<AccountTicketsResponse, void>({
        query: () => checkinEndpoint.myTickets,
        providesTags: ['AccountTickets'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetMyTicketCheckInQuery,
  useSubmitMyTicketCheckInMutation,
  useGetMyTicketWalletQuery,
  useLazyGetMyTicketWalletQuery,
  useInitiateMyTicketTopUpMutation,
  useGetMyAccountTicketsQuery,
} = checkinApi;
