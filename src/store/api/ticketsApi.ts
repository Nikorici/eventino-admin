import { endpoints, eventEndpoint } from '@/lib/constants';
import type {
  Coupon,
  CreateOrderBody,
  CreateOrderResponse,
  RefundEligibility,
  TicketOrder,
  TicketType,
} from '@/types/api';

import { baseApi } from './baseApi';

export const ticketsApi = baseApi.enhanceEndpoints({ addTagTypes: ['Refund'] }).injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<CreateOrderResponse, CreateOrderBody>({
      query: (body) => ({ url: endpoints.tickets, method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    getMyOrders: builder.query<TicketOrder[], 'active' | 'inactive'>({
      query: (status) => `${endpoints.ticketOrders}?status=${status}`,
      transformResponse: (response: TicketOrder[] | { results: TicketOrder[] }) =>
        Array.isArray(response) ? response : (response.results ?? []),
      providesTags: ['Order'],
    }),
    getOrder: builder.query<TicketOrder, number | string>({
      query: (orderId) => eventEndpoint.order(orderId),
      providesTags: (_result, _error, orderId) => [{ type: 'Order', id: orderId }],
    }),
    syncOrderPayment: builder.mutation<TicketOrder, number | string>({
      query: (orderId) => ({ url: eventEndpoint.syncOrderPayment(orderId), method: 'POST' }),
      invalidatesTags: (_result, _error, orderId) => [{ type: 'Order', id: orderId }],
    }),
    getRefundEligibility: builder.query<RefundEligibility, number | string>({
      query: (orderId) => eventEndpoint.refundEligibility(orderId),
      providesTags: (_result, _error, orderId) => [{ type: 'Refund', id: orderId }],
    }),
    requestRefund: builder.mutation<RefundEligibility, number | string>({
      query: (orderId) => ({ url: eventEndpoint.requestRefund(orderId), method: 'POST' }),
      invalidatesTags: (_result, _error, orderId) => [
        { type: 'Refund', id: orderId },
        { type: 'Order', id: orderId },
        'Order',
      ],
    }),
    verifyCoupon: builder.mutation<Coupon, { event_id: number; code: string }>({
      query: (body) => ({ url: endpoints.eventCoupons, method: 'POST', body }),
    }),
    getTicketTypesByEvent: builder.query<TicketType[], number | string>({
      query: (eventId) => `${endpoints.ticketTypesByEvent}?event_id=${eventId}`,
      providesTags: ['Ticket'],
    }),
    getHasBoughtTickets: builder.query<{ has_bought_tickets: boolean }, number | string>({
      query: (eventId) => eventEndpoint.hasBoughtTickets(eventId),
      providesTags: ['Order'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateOrderMutation,
  useGetMyOrdersQuery,
  useGetOrderQuery,
  useSyncOrderPaymentMutation,
  useGetRefundEligibilityQuery,
  useRequestRefundMutation,
  useVerifyCouponMutation,
  useGetTicketTypesByEventQuery,
  useGetHasBoughtTicketsQuery,
} = ticketsApi;
