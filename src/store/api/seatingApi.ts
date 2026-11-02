import { eventEndpoint, venueEndpoint } from '@/lib/constants';
import type {
  EventSeatMapResponse,
  HoldSeatsBody,
  SeatHoldPayload,
  SeatMapConfigPayload,
  SeatMapConfigResponse,
  SeatStatusResponse,
  ValidateHoldResponse,
  VenueLayoutDetail,
} from '@/types/seating';

import { baseApi } from './baseApi';

export const SEAT_HOLD_TOKEN_HEADER = 'X-Seat-Hold-Token';

export interface HoldRequest {
  eventId: number | string;
  holdToken: string;
}

export interface HoldSeatsRequest {
  eventId: number | string;
  body: HoldSeatsBody;
}

export type PaymentLinkTableStatus = 'available' | 'blocked' | 'linked' | 'reserved' | 'sold' | 'unavailable';

export interface PaymentLinkTable {
  seat_id: number;
  section_id: number;
  name: string;
  name_i18n: Record<string, string> | null;
  ticket_type_id: number | null;
  ticket_type_name: string | null;
  price: string | null;
  status: PaymentLinkTableStatus;
  linkable: boolean;
}

export type PaymentLinkStatus = 'active' | 'paying' | 'paid' | 'expired' | 'cancelled';

export interface TablePaymentLink {
  id: number;
  token: string;
  url: string | null;
  seat_id: number;
  section_id: number;
  table_name: string;
  ticket_type_id: number | null;
  ticket_type_name: string | null;
  price: string | null;
  currency: string;
  client_name: string;
  note: string;
  expires_at: string;
  cancelled_at: string | null;
  created_at: string;
  status: PaymentLinkStatus;
  order_id: number | null;
}

export interface PaymentLinksOverview {
  currency: string;
  site_url: string | null;
  tables: PaymentLinkTable[];
  links: TablePaymentLink[];
}

export interface PaymentLinkPayload {
  seat_id: number;
  client_name: string;
  note?: string;
  expires_at: string;
}

const paymentLinkEndpoints = {
  list: (eventId: number | string) => `/api/v1/events/${eventId}/seat-map/payment-links/`,
  cancel: (eventId: number | string, linkId: number) => `/api/v1/events/${eventId}/seat-map/payment-links/${linkId}/cancel/`,
} as const;

function seatConfigTags(eventId: number | string) {
  return [
    { type: 'SeatMapConfig' as const, id: Number(eventId) },
    { type: 'SeatMap' as const, id: Number(eventId) },
    { type: 'EventDetail' as const, id: Number(eventId) },
    { type: 'EventVenues' as const, id: Number(eventId) },
    { type: 'PaymentLinks' as const, id: Number(eventId) },
  ];
}

export const seatingApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['SeatMap', 'SeatHold', 'SeatMapConfig', 'EventVenues', 'PaymentLinks'] })
  .injectEndpoints({
  endpoints: (builder) => ({
    getEventSeatMap: builder.query<EventSeatMapResponse, number | string>({
      query: (eventId) => eventEndpoint.seatMap(eventId),
      providesTags: (_result, _error, eventId) => [{ type: 'SeatMap', id: Number(eventId) }],
    }),
    getSeatStatuses: builder.query<SeatStatusResponse, number | string>({
      query: (eventId) => eventEndpoint.seatStatus(eventId),
      keepUnusedDataFor: 0,
    }),
    getHold: builder.query<SeatHoldPayload, HoldRequest>({
      query: ({ eventId, holdToken }) => ({
        url: eventEndpoint.seatHold(eventId),
        headers: { [SEAT_HOLD_TOKEN_HEADER]: holdToken },
      }),
      keepUnusedDataFor: 0,
      providesTags: (_result, _error, { holdToken }) => [{ type: 'SeatHold', id: holdToken }],
    }),
    holdSeats: builder.mutation<SeatHoldPayload, HoldSeatsRequest>({
      query: ({ eventId, body }) => ({ url: eventEndpoint.seatHold(eventId), method: 'POST', body }),
      invalidatesTags: (result, _error, { body }) =>
        [body.hold_token, result?.hold_token]
          .filter((token): token is string => typeof token === 'string' && token.length > 0)
          .map((token) => ({ type: 'SeatHold' as const, id: token })),
    }),
    releaseHold: builder.mutation<void, HoldRequest>({
      query: ({ eventId, holdToken }) => ({
        url: eventEndpoint.seatHold(eventId),
        method: 'DELETE',
        headers: { [SEAT_HOLD_TOKEN_HEADER]: holdToken },
      }),
      invalidatesTags: (_result, _error, { holdToken }) => [{ type: 'SeatHold', id: holdToken }],
    }),
    validateHold: builder.mutation<ValidateHoldResponse, HoldRequest>({
      query: ({ eventId, holdToken }) => ({
        url: eventEndpoint.seatValidate(eventId),
        method: 'POST',
        body: { hold_token: holdToken },
      }),
    }),
    getSeatMapConfig: builder.query<SeatMapConfigResponse, number | string>({
      query: (eventId) => venueEndpoint.seatMapConfig(eventId),
      providesTags: (_result, _error, eventId) => [{ type: 'SeatMapConfig', id: Number(eventId) }],
    }),
    putSeatMapConfig: builder.mutation<SeatMapConfigResponse, { eventId: number | string; body: SeatMapConfigPayload }>({
      query: ({ eventId, body }) => ({ url: venueEndpoint.seatMapConfig(eventId), method: 'PUT', body }),
      invalidatesTags: (_result, _error, { eventId }) => seatConfigTags(eventId),
    }),
    deleteSeatMapConfig: builder.mutation<{ success: boolean }, number | string>({
      query: (eventId) => ({ url: venueEndpoint.seatMapConfig(eventId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, eventId) => seatConfigTags(eventId),
    }),
    getVenueLayout: builder.query<VenueLayoutDetail, number | string>({
      query: (layoutId) => venueEndpoint.venueLayout(layoutId),
    }),
    getPaymentLinks: builder.query<PaymentLinksOverview, number | string>({
      query: (eventId) => paymentLinkEndpoints.list(eventId),
      providesTags: (_result, _error, eventId) => [{ type: 'PaymentLinks', id: Number(eventId) }],
    }),
    createPaymentLink: builder.mutation<TablePaymentLink, { eventId: number | string; body: PaymentLinkPayload }>({
      query: ({ eventId, body }) => ({ url: paymentLinkEndpoints.list(eventId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { eventId }) => [
        { type: 'PaymentLinks', id: Number(eventId) },
        { type: 'SeatMapConfig', id: Number(eventId) },
      ],
    }),
    cancelPaymentLink: builder.mutation<TablePaymentLink, { eventId: number | string; linkId: number }>({
      query: ({ eventId, linkId }) => ({ url: paymentLinkEndpoints.cancel(eventId, linkId), method: 'POST' }),
      invalidatesTags: (_result, _error, { eventId }) => [
        { type: 'PaymentLinks', id: Number(eventId) },
        { type: 'SeatMapConfig', id: Number(eventId) },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEventSeatMapQuery,
  useLazyGetEventSeatMapQuery,
  useGetSeatStatusesQuery,
  useLazyGetSeatStatusesQuery,
  useGetHoldQuery,
  useLazyGetHoldQuery,
  useHoldSeatsMutation,
  useReleaseHoldMutation,
  useValidateHoldMutation,
  useGetSeatMapConfigQuery,
  usePutSeatMapConfigMutation,
  useDeleteSeatMapConfigMutation,
  useLazyGetVenueLayoutQuery,
  useGetPaymentLinksQuery,
  useCreatePaymentLinkMutation,
  useCancelPaymentLinkMutation,
} = seatingApi;
