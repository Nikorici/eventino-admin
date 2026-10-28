import { baseApi } from './baseApi';

const referralEndpoints = {
  promoters: '/api/v1/referrals/promoters/',
  promoter: (promoterId: number) => `/api/v1/referrals/promoters/${promoterId}/`,
  stats: '/api/v1/referrals/stats/',
  timeline: '/api/v1/referrals/stats/timeline/',
  trafficStats: (eventId: number) => `/api/v1/tracking/stats/${eventId}/`,
} as const;

export type ReferralInterval = 'daily' | 'weekly' | 'monthly';

export const REFERRAL_INTERVAL_DAYS: Record<ReferralInterval, number> = {
  daily: 14,
  weekly: 56,
  monthly: 180,
};

export interface ReferralLinkInfo {
  id: number;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface Promoter {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  referral_link: ReferralLinkInfo | null;
  clicks: number;
  orders: number;
  revenue: number | string;
  conversion_rate: number;
}

export interface CreatePromoterBody {
  eventId: number;
  name: string;
  notes: string;
}

export interface UpdatePromoterBody {
  promoterId: number;
  eventId: number;
  isActive: boolean;
}

export interface ReferralStats {
  active_promoters: number;
  total_clicks: number;
  attributed_orders: number;
  referred_revenue: number | string;
  conversion_rate: number;
}

export interface ReferralTimelinePoint {
  date: string;
  clicks: number;
  conversions: number;
}

export interface TrafficReferrerStat {
  referrer: string;
  total_clicks: number;
}

export interface EventTrafficStats {
  event_id: number;
  total_clicks: number;
  by_referrer: TrafficReferrerStat[];
}

export const referralsApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Promoters', 'ReferralStats'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getPromoters: builder.query<Promoter[], number>({
        query: (eventId) => `${referralEndpoints.promoters}?event_id=${eventId}`,
        transformResponse: (response: Promoter[] | { results?: Promoter[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: (_result, _error, eventId) => [{ type: 'Promoters', id: eventId }],
      }),
      createPromoter: builder.mutation<Promoter, CreatePromoterBody>({
        query: ({ eventId, name, notes }) => ({
          url: referralEndpoints.promoters,
          method: 'POST',
          body: { event_id: eventId, name, notes },
        }),
        invalidatesTags: (_result, _error, { eventId }) => [
          { type: 'Promoters', id: eventId },
          { type: 'ReferralStats', id: eventId },
        ],
      }),
      updatePromoter: builder.mutation<Promoter, UpdatePromoterBody>({
        query: ({ promoterId, eventId, isActive }) => ({
          url: `${referralEndpoints.promoter(promoterId)}?event_id=${eventId}`,
          method: 'PATCH',
          body: { is_active: isActive },
        }),
        invalidatesTags: (_result, _error, { eventId }) => [
          { type: 'Promoters', id: eventId },
          { type: 'ReferralStats', id: eventId },
        ],
      }),
      getReferralStats: builder.query<ReferralStats, number>({
        query: (eventId) => `${referralEndpoints.stats}?event_id=${eventId}`,
        providesTags: (_result, _error, eventId) => [{ type: 'ReferralStats', id: eventId }],
      }),
      getReferralTimeline: builder.query<ReferralTimelinePoint[], { eventId: number; interval: ReferralInterval }>({
        query: ({ eventId, interval }) =>
          `${referralEndpoints.timeline}?event_id=${eventId}&interval=${interval}&days=${REFERRAL_INTERVAL_DAYS[interval]}`,
        transformResponse: (response: ReferralTimelinePoint[] | { results?: ReferralTimelinePoint[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: (_result, _error, { eventId }) => [{ type: 'ReferralStats', id: eventId }],
      }),
      getEventTrafficStats: builder.query<EventTrafficStats, number>({
        query: (eventId) => referralEndpoints.trafficStats(eventId),
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetPromotersQuery,
  useCreatePromoterMutation,
  useUpdatePromoterMutation,
  useGetReferralStatsQuery,
  useGetReferralTimelineQuery,
  useGetEventTrafficStatsQuery,
} = referralsApi;
