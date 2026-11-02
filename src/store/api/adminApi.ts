import { combineDateTime, getEventTimeStatus } from '@/lib/eventStatus';

import { baseApi } from './baseApi';

const adminEndpoints = {
  moldova: '/api/v1/statistics/get_staff_ticket_data/',
  romania: '/api/v1/statistics/get_staff_ticket_data_ro/',
  paymentStatus: '/api/v1/statistics/set-event-payment-status/',
} as const;

export type AdminEventsCountry = 'ro' | 'md';

export type StaffPaymentFilter = 'all' | 'done' | 'pending';

export interface StaffEventCoupon {
  code: string;
  discount: string;
  usage_count: number;
}

export interface StaffEvent {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  in_draft: boolean;
  income: number;
  platform_fee: number;
  payment_done: boolean;
  country: string | null;
  region: string | null;
  currency: string | null;
  coupons: StaffEventCoupon[];
  owner_name: string;
  owner_id: number | null;
  owner_slug: string;
}

export interface StaffEventsResponse {
  events: StaffEvent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  filters?: { countries: string[]; regions: string[] };
}

export interface StaffEventsParams {
  country: AdminEventsCountry;
  page: number;
  pageSize: number;
  search: string;
  countryFilter: string;
  region: string;
  payment: StaffPaymentFilter;
}

export interface EventPaymentStatusResponse {
  event_id: number;
  payment_done: boolean;
}

function staffEventRank(event: StaffEvent, now: Date): number {
  const status = getEventTimeStatus(event, now);
  if (status === 'live') return 0;
  if (status === 'today' || status === 'upcoming') return 1;
  return 2;
}

export function sortStaffEvents(events: StaffEvent[], now = new Date()): StaffEvent[] {
  const startOf = (event: StaffEvent) => combineDateTime(event.start_date, event.start_time)?.getTime() ?? 0;
  return [...events].sort((a, b) => staffEventRank(a, now) - staffEventRank(b, now) || startOf(b) - startOf(a));
}

export const adminApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminEvents'] }).injectEndpoints({
  endpoints: (builder) => ({
    getStaffEvents: builder.query<StaffEventsResponse, StaffEventsParams>({
      query: ({ country, page, pageSize, search, countryFilter, region, payment }) => ({
        url: country === 'ro' ? adminEndpoints.romania : adminEndpoints.moldova,
        method: 'POST',
        body: { page, page_size: pageSize, search: search.trim(), country: countryFilter, region, payment },
      }),
      transformResponse: (response: StaffEventsResponse) => ({ ...response, events: sortStaffEvents(response.events ?? []) }),
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}:${queryArgs.country}:${queryArgs.search}:${queryArgs.countryFilter}:${queryArgs.region}:${queryArgs.payment}`,
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page <= 1) {
          currentCache.events = newItems.events;
        } else {
          const seen = new Set(currentCache.events.map((event) => event.id));
          for (const event of newItems.events) {
            if (!seen.has(event.id)) currentCache.events.push(event);
          }
        }
        currentCache.total = newItems.total;
        currentCache.page = newItems.page;
        currentCache.page_size = newItems.page_size;
        currentCache.pages = newItems.pages;
        currentCache.filters = newItems.filters;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ['AdminEvents'],
    }),
    setEventPaymentStatus: builder.mutation<EventPaymentStatusResponse, { eventId: number; paymentDone: boolean }>({
      query: ({ eventId, paymentDone }) => ({
        url: adminEndpoints.paymentStatus,
        method: 'POST',
        body: { event_id: eventId, payment_done: paymentDone },
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetStaffEventsQuery, useSetEventPaymentStatusMutation } = adminApi;
