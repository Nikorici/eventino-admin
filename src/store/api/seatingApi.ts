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

function seatConfigTags(eventId: number | string) {
  return [
    { type: 'SeatMapConfig' as const, id: Number(eventId) },
    { type: 'SeatMap' as const, id: Number(eventId) },
    { type: 'EventDetail' as const, id: Number(eventId) },
    { type: 'EventVenues' as const, id: Number(eventId) },
  ];
}

export const seatingApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['SeatMap', 'SeatHold', 'SeatMapConfig', 'EventVenues'] })
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
} = seatingApi;
