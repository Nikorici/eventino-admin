import { baseApi } from './baseApi';

const trafficEndpoints = {
  organizerStats: '/api/v1/tracking/stats/',
  profileTrack: '/api/v1/tracking/profile/track/',
} as const;

export interface OrgTrafficReferrerStat {
  referrer: string;
  total_clicks: number;
  percentage: number;
}

export interface OrgTrafficStats {
  total_clicks: number;
  event_count: number;
  by_referrer: OrgTrafficReferrerStat[];
}

export interface OrgTrafficStatsArgs {
  from?: string;
  to?: string;
}

function buildTrafficQuery(args: OrgTrafficStatsArgs): string {
  const parts: string[] = [];
  if (args.from) parts.push(`from=${encodeURIComponent(args.from)}`);
  if (args.to) parts.push(`to=${encodeURIComponent(args.to)}`);
  return parts.length > 0
    ? `${trafficEndpoints.organizerStats}?${parts.join('&')}`
    : trafficEndpoints.organizerStats;
}

export const trafficApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['OrgTraffic'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getOrgTrafficStats: builder.query<OrgTrafficStats, OrgTrafficStatsArgs>({
        query: (args) => buildTrafficQuery(args),
        transformResponse: (response: Partial<OrgTrafficStats>): OrgTrafficStats => ({
          total_clicks: response.total_clicks ?? 0,
          event_count: response.event_count ?? 0,
          by_referrer: response.by_referrer ?? [],
        }),
        providesTags: ['OrgTraffic'],
      }),
      trackProfileView: builder.mutation<void, number>({
        query: (profileId) => ({
          url: trafficEndpoints.profileTrack,
          method: 'POST',
          body: { profile_id: profileId, referrer: '' },
        }),
      }),
    }),
    overrideExisting: false,
  });

export const { useGetOrgTrafficStatsQuery, useTrackProfileViewMutation } = trafficApi;
