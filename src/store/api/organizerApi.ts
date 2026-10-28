import { eventEndpoint, organizerTicketEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

const organizerEndpoints = {
  recentStats: '/api/v1/statistics/get-recent-stats/',
  eventList: '/api/v1/statistics/event-list/',
  statsGraph: '/api/v1/statistics/get-stats-graph/',
  ticketTypeSales: '/api/v1/statistics/get-ticket-type-sales/',
  buyersList: '/api/v1/statistics/get-buyers-list/',
  scannedTicketsStats: '/api/v1/statistics/get-scanned-tickets-stats/',
  releaseManualTicket: (eventId: number | string) => `/api/v1/tickets/${eventId}/release-manual-ticket/`,
  freeTicketRequests: '/api/v1/tickets/free-ticket-requests/',
  sendFreeTicket: '/api/v1/tickets/send-free-ticket/',
  rejectFreeTicket: '/api/v1/tickets/reject-free-ticket/',
  pendingOrders: '/api/v1/tickets/pending-orders/',
  markInvoiceAsPaid: '/api/v1/tickets/mark-invoice-as-paid/',
  ticketType: (ticketTypeId: number | string) => `/api/v1/ticket-types/${ticketTypeId}/`,
} as const;

export const ordersSettlementExportEndpoint = '/api/v1/statistics/get-orders-settlement-export/';

export interface FreeTicketRequest {
  order_id: number;
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  account_name?: string | null;
  email?: string | null;
  ticket_name?: string | null;
  ticket_count?: number;
  currency?: string | null;
  total_price?: number;
  date?: string | null;
  created_at?: string | null;
}

export interface ReleaseManualTicketBody {
  eventId: number;
  firstName: string;
  lastName: string;
  email: string;
  ticketTypeId: number;
  quantity: number;
  phone?: string;
  zoneId?: number;
  seat_ids?: number[];
}

export interface TicketTypeSale {
  id: number;
  name: string;
  price: number;
  currency: string;
  total_quantity: number | null;
  sold_quantity: number;
  sold_quantity_excluding_zero: number;
  remaining_quantity: number | null;
}

export interface TicketTypeSalesResponse {
  ticket_types: TicketTypeSale[];
}

export interface ManagedTicketType {
  id: number;
  event: number;
  name: string;
  price: string;
  quantity: number | null;
  category?: string | null;
  comment?: string | null;
  qr_code_quantity?: number;
  display_order?: number;
  is_table?: boolean;
  show_remaining_tickets?: boolean;
  is_active: boolean;
  sold_count: number;
  remaining: number | null;
}

export interface UpdateTicketTypeBody {
  id: number;
  name: string;
  price: string;
  quantity: number | null;
  isActive: boolean;
}

interface MarketingPixelsSource {
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
}

export interface MarketingPixels {
  meta_pixel_id: string | null;
  tiktok_pixel_id: string | null;
}

export interface BuyerQuestionAnswer {
  question?: string | null;
  question_type?: string | null;
  answer?: string | string[] | number | null;
}

export type BuyerParticipantInfo = Record<string, string | number | null>;

export interface EventBuyer {
  id?: number;
  order_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  account_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  ticket_name?: string | null;
  ticket_count?: number;
  currency?: string | null;
  total_price?: number;
  order_date?: string | null;
  date?: string | null;
  payment_method?: string | null;
  user_type?: string | null;
  attendance_status?: string | null;
  scanned_count?: number;
  coupon_code?: string | null;
  questions_and_answers?: BuyerQuestionAnswer[];
  participants_info?: BuyerParticipantInfo[];
}

export type BuyersAttendanceFilter = 'all' | 'scanned' | 'not_scanned';
export type BuyersTimeInterval = 'all' | 'month' | 'week' | 'day';

export interface EventTicketRecord {
  id: number;
  uuid: string;
  ticket_type: string;
  display_name?: string | null;
  account_name?: string | null;
  email?: string | null;
  order_id?: number | null;
  order_date?: string | null;
}

export interface PendingOrderUser {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface PendingOrderTicket {
  ticket_type_name?: string | null;
  price?: string | null;
}

export interface PendingOrder {
  id: number;
  user?: PendingOrderUser | null;
  order_date?: string | null;
  total_price?: string | null;
  payment_method?: string | null;
  tickets?: PendingOrderTicket[];
}

export interface MarkInvoiceAsPaidResponse {
  message?: string;
}

export interface ScannedTicketTypeStats {
  id: number;
  name: string;
  total_tickets: number;
  scanned_tickets: number;
  unscanned_tickets: number;
  scan_percentage: number;
}

export interface ScannedTicketsStatsResponse {
  ticket_types: ScannedTicketTypeStats[];
}

function attendanceRequestFields(attendance: BuyersAttendanceFilter): Record<string, string | boolean> {
  if (attendance === 'scanned') {
    return { attendance_status: 'attended', attendance_filter: 'scanned', is_scanned: true };
  }
  if (attendance === 'not_scanned') {
    return { attendance_status: 'no_show', attendance_filter: 'not_scanned', is_scanned: false };
  }
  return {};
}

export interface BuyersResponse {
  results: EventBuyer[];
  total_count?: number;
  has_next?: boolean;
  has_previous?: boolean;
  page?: number;
  page_size?: number;
}

export type GraphInterval = 'month' | 'week' | 'day' | 'year';

export interface OrganizerGraphPoint {
  date: string;
  new_users: number;
  income: number;
  income_by_currency: Record<string, number>;
  tickets_sold: number;
  favorited_by: number;
}

export interface OrganizerStatsBucket {
  new_users: number;
  income: number;
  income_by_currency: Record<string, number>;
  tickets_sold: number;
  favorited_by: number;
  total_tickets: number;
  scanned_tickets: number;
  not_scanned_tickets: number;
  manual_tickets_count: number;
  manual_scanned_tickets: number;
  not_manual_scanned_tickets: number;
  invoice_income_total: number;
  invoice_income_by_currency: Record<string, number>;
  total_received: number;
  total_received_by_currency: Record<string, number>;
  event_currency: string;
  income_currency: string;
}

export interface OrganizerRecentStats {
  this_week: OrganizerStatsBucket;
  previous_week: OrganizerStatsBucket;
  all_time: OrganizerStatsBucket;
  event_currencies: string[];
}

export interface OrganizerEventListItem {
  id: number;
  name: string;
  image: string | null;
  start_date: string | null;
  start_time?: string | null;
  end_date: string | null;
  end_time?: string | null;
  income: number;
  participants_count: number;
  tickets_count: number;
  country: string | null;
  currency: string | null;
  region: string | null;
  in_draft?: boolean;
  is_cancelled?: boolean;
}

export interface OrganizerEventListResponse {
  events: OrganizerEventListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OrganizerEventsParams {
  page?: number;
  page_size?: number;
}

const enhancedApi = baseApi.enhanceEndpoints({ addTagTypes: ['ManagedTicketType', 'EventTickets'] });

export const organizerApi = enhancedApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrganizerStats: builder.query<OrganizerRecentStats, number | undefined>({
      query: (eventId) => ({
        url: organizerEndpoints.recentStats,
        method: 'POST',
        body: { time_interval: 'all_time', ...(eventId != null ? { event_id: eventId } : {}) },
      }),
    }),
    getOrganizerEvents: builder.query<OrganizerEventListResponse, OrganizerEventsParams | void>({
      query: (params) => ({
        url: organizerEndpoints.eventList,
        method: 'POST',
        body: { page: params?.page ?? 1, page_size: params?.page_size ?? 1000 },
      }),
    }),
    getOrganizerGraph: builder.query<OrganizerGraphPoint[], { interval: GraphInterval; eventId?: number }>({
      query: ({ interval, eventId }) => ({
        url: organizerEndpoints.statsGraph,
        method: 'POST',
        body: { time_interval: interval, ...(eventId != null ? { event_id: eventId } : {}) },
      }),
      transformResponse: (response: OrganizerGraphPoint[] | { results?: OrganizerGraphPoint[] }) =>
        Array.isArray(response) ? response : (response?.results ?? []),
    }),
    getTicketTypeSales: builder.query<TicketTypeSalesResponse, number>({
      query: (eventId) => ({
        url: organizerEndpoints.ticketTypeSales,
        method: 'POST',
        body: { event_id: eventId },
      }),
      providesTags: ['ManagedTicketType'],
    }),
    getManagedTicketType: builder.query<ManagedTicketType, number>({
      query: (ticketTypeId) => organizerEndpoints.ticketType(ticketTypeId),
      providesTags: (_result, _error, ticketTypeId) => [{ type: 'ManagedTicketType', id: ticketTypeId }],
    }),
    updateTicketType: builder.mutation<ManagedTicketType, UpdateTicketTypeBody>({
      query: ({ id, name, price, quantity, isActive }) => ({
        url: organizerEndpoints.ticketType(id),
        method: 'PATCH',
        body: { name, price, quantity, is_active: isActive },
      }),
      invalidatesTags: ['ManagedTicketType'],
    }),
    getMarketingPixels: builder.query<MarketingPixels, number>({
      query: (userId) => eventEndpoint.user(userId),
      transformResponse: (response: MarketingPixelsSource) => ({
        meta_pixel_id: response.meta_pixel_id ?? null,
        tiktok_pixel_id: response.tiktok_pixel_id ?? null,
      }),
      providesTags: (_result, _error, userId) => [{ type: 'User', id: userId }],
    }),
    getEventBuyers: builder.query<
      BuyersResponse,
      { eventId: number; page?: number; search?: string; attendance?: BuyersAttendanceFilter; timeInterval?: BuyersTimeInterval }
    >({
      query: ({ eventId, page = 1, search = '', attendance = 'all', timeInterval = 'all' }) => ({
        url: organizerEndpoints.buyersList,
        method: 'POST',
        body: {
          event_id: eventId,
          time_interval: timeInterval,
          page,
          page_size: 20,
          search,
          ...attendanceRequestFields(attendance),
        },
      }),
      transformResponse: (response: BuyersResponse | EventBuyer[]) =>
        Array.isArray(response) ? { results: response } : response,
      serializeQueryArgs: ({ queryArgs }) => ({
        eventId: queryArgs.eventId,
        search: queryArgs.search ?? '',
        attendance: queryArgs.attendance ?? 'all',
        timeInterval: queryArgs.timeInterval ?? 'all',
      }),
      merge: (currentCache, newItems, { arg }) => {
        if ((arg.page ?? 1) <= 1) {
          currentCache.results = newItems.results;
          currentCache.has_next = newItems.has_next;
          currentCache.page = newItems.page;
          currentCache.total_count = newItems.total_count;
          return;
        }
        currentCache.results.push(...newItems.results);
        currentCache.has_next = newItems.has_next;
        currentCache.page = newItems.page;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.page !== previousArg?.page ||
        currentArg?.search !== previousArg?.search ||
        currentArg?.attendance !== previousArg?.attendance,
      providesTags: ['Buyers'],
    }),
    getScannedTicketsStats: builder.query<ScannedTicketsStatsResponse, number>({
      query: (eventId) => ({
        url: organizerEndpoints.scannedTicketsStats,
        method: 'POST',
        body: { event_id: eventId },
      }),
    }),
    getPendingOrders: builder.query<PendingOrder[], number>({
      query: (eventId) => `${organizerEndpoints.pendingOrders}?event_id=${eventId}`,
      transformResponse: (response: PendingOrder[] | { results?: PendingOrder[] }) =>
        Array.isArray(response) ? response : (response?.results ?? []),
    }),
    markInvoiceAsPaid: builder.mutation<MarkInvoiceAsPaidResponse, number>({
      query: (orderId) => ({
        url: organizerEndpoints.markInvoiceAsPaid,
        method: 'POST',
        body: { order_id: orderId },
      }),
      invalidatesTags: ['Buyers'],
    }),
    getEventTickets: builder.query<EventTicketRecord[], number>({
      query: (eventId) => organizerTicketEndpoint.eventTickets(eventId),
      transformResponse: (response: EventTicketRecord[] | { results?: EventTicketRecord[] }) =>
        Array.isArray(response) ? response : (response?.results ?? []),
      providesTags: (_result, _error, eventId) => [{ type: 'EventTickets', id: eventId }],
    }),
    setTicketDisplayName: builder.mutation<{ id: number; display_name: string }, { eventId: number; ticketId: number; displayName: string }>({
      query: ({ ticketId, displayName }) => ({
        url: organizerTicketEndpoint.setDisplayName(ticketId),
        method: 'PATCH',
        body: { display_name: displayName },
      }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'EventTickets', id: eventId }],
    }),
    cancelEvent: builder.mutation<unknown, { eventId: number; reason: string }>({
      query: ({ eventId, reason }) => ({ url: organizerTicketEndpoint.cancelEvent(eventId), method: 'POST', body: { reason } }),
      invalidatesTags: (_result, _error, { eventId }) => [{ type: 'EventDetail', id: eventId }, 'Event'],
    }),
    releaseManualTicket: builder.mutation<unknown, ReleaseManualTicketBody>({
      query: ({ eventId, ...body }) => ({
        url: organizerEndpoints.releaseManualTicket(eventId),
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Buyers'],
    }),
    getFreeTicketRequests: builder.query<FreeTicketRequest[], number>({
      query: (eventId) => `${organizerEndpoints.freeTicketRequests}?event_id=${eventId}`,
      transformResponse: (response: FreeTicketRequest[] | { results?: FreeTicketRequest[] }) =>
        Array.isArray(response) ? response : (response?.results ?? []),
      providesTags: ['FreeTickets'],
    }),
    sendFreeTicket: builder.mutation<unknown, number>({
      query: (orderId) => ({
        url: organizerEndpoints.sendFreeTicket,
        method: 'POST',
        body: { order_id: orderId },
      }),
      invalidatesTags: ['FreeTickets', 'Buyers'],
    }),
    rejectFreeTicket: builder.mutation<unknown, number>({
      query: (orderId) => ({
        url: organizerEndpoints.rejectFreeTicket,
        method: 'POST',
        body: { order_id: orderId },
      }),
      invalidatesTags: ['FreeTickets'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOrganizerStatsQuery,
  useGetOrganizerEventsQuery,
  useGetOrganizerGraphQuery,
  useGetTicketTypeSalesQuery,
  useGetManagedTicketTypeQuery,
  useUpdateTicketTypeMutation,
  useGetMarketingPixelsQuery,
  useGetEventBuyersQuery,
  useGetScannedTicketsStatsQuery,
  useGetPendingOrdersQuery,
  useMarkInvoiceAsPaidMutation,
  useReleaseManualTicketMutation,
  useGetEventTicketsQuery,
  useSetTicketDisplayNameMutation,
  useCancelEventMutation,
  useGetFreeTicketRequestsQuery,
  useSendFreeTicketMutation,
  useRejectFreeTicketMutation,
} = organizerApi;
