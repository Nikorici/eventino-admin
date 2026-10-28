import { baseApi } from './baseApi';

const couponEndpoints = {
  coupons: '/api/v1/event_coupons/',
  couponsByEvent: (eventId: number) => `/api/v1/event_coupons/by-event/?event_id=${eventId}`,
  coupon: (couponId: number) => `/api/v1/event_coupons/${couponId}/`,
  ticketTypesByEvent: (eventId: number) => `/api/v1/ticket-types/by-event/?event_id=${eventId}`,
} as const;

export interface EventCoupon {
  id: number;
  code: string;
  discount: number;
  max_uses: number;
  is_active: boolean;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  ticket_types: number[];
  limit_one_use_per_account: boolean;
  limit_one_use_per_ip: boolean;
}

export interface CouponPayload {
  code: string;
  discount: number;
  max_uses: number;
  is_active: boolean;
  ticket_types: number[];
  valid_from: string | null;
  valid_until: string | null;
  limit_one_use_per_account: boolean;
  limit_one_use_per_ip: boolean;
}

export interface CreateCouponParams extends CouponPayload {
  event: number;
}

export interface UpdateCouponParams {
  couponId: number;
  eventId: number;
  body: Partial<CouponPayload>;
}

export interface DeleteCouponParams {
  couponId: number;
  eventId: number;
}

export interface CouponScopeTicketType {
  id: number;
  name: string;
  is_active?: boolean;
}

function toCouponList(response: EventCoupon[] | { results?: EventCoupon[] }): EventCoupon[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

function toTicketTypeList(
  response: CouponScopeTicketType[] | { results?: CouponScopeTicketType[] },
): CouponScopeTicketType[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const couponsApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Coupons', 'CouponTicketTypes'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventCoupons: builder.query<EventCoupon[], number>({
        query: (eventId) => couponEndpoints.couponsByEvent(eventId),
        transformResponse: toCouponList,
        providesTags: (_result, _error, eventId) => [{ type: 'Coupons', id: eventId }],
      }),
      getCouponScopeTicketTypes: builder.query<CouponScopeTicketType[], number>({
        query: (eventId) => couponEndpoints.ticketTypesByEvent(eventId),
        transformResponse: toTicketTypeList,
        providesTags: (_result, _error, eventId) => [{ type: 'CouponTicketTypes', id: eventId }],
      }),
      createCoupon: builder.mutation<EventCoupon, CreateCouponParams>({
        query: (body) => ({
          url: couponEndpoints.coupons,
          method: 'POST',
          body,
        }),
        invalidatesTags: (_result, _error, { event }) => [{ type: 'Coupons', id: event }],
      }),
      updateCoupon: builder.mutation<EventCoupon, UpdateCouponParams>({
        query: ({ couponId, body }) => ({
          url: couponEndpoints.coupon(couponId),
          method: 'PATCH',
          body,
        }),
        invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Coupons', id: eventId }],
      }),
      deleteCoupon: builder.mutation<unknown, DeleteCouponParams>({
        query: ({ couponId }) => ({
          url: couponEndpoints.coupon(couponId),
          method: 'DELETE',
        }),
        invalidatesTags: (_result, _error, { eventId }) => [{ type: 'Coupons', id: eventId }],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetEventCouponsQuery,
  useGetCouponScopeTicketTypesQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
} = couponsApi;
