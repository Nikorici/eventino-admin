import { baseApi } from './baseApi';

const adminEndpoints = {
  moldova: '/api/v1/statistics/get_staff_ticket_data/',
  romania: '/api/v1/statistics/get_staff_ticket_data_ro/',
} as const;

export type AdminEventsCountry = 'ro' | 'md';

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
}

export interface StaffEventsParams {
  country: AdminEventsCountry;
  page: number;
  pageSize: number;
  search: string;
}

export const adminApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminEvents'] }).injectEndpoints({
  endpoints: (builder) => ({
    getStaffEvents: builder.query<StaffEventsResponse, StaffEventsParams>({
      query: ({ country, page, pageSize, search }) => ({
        url: country === 'ro' ? adminEndpoints.romania : adminEndpoints.moldova,
        method: 'POST',
        body: search ? { page, page_size: pageSize, search } : { page, page_size: pageSize },
      }),
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}:${queryArgs.country}:${queryArgs.search}`,
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
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ['AdminEvents'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetStaffEventsQuery } = adminApi;
