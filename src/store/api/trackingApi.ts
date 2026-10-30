import { baseApi } from './baseApi';

const trackingEndpoints = {
  eventStats: (eventId: number) => `/api/v1/tracking/stats/${eventId}/`,
  buyerLocations: (eventId: number) => `/api/v1/tracking/stats/${eventId}/buyer-locations/`,
} as const;

export interface TrafficReferrer {
  referrer: string | null;
  embedded_on?: string | null;
  total_clicks: number;
}

export interface EventTrafficSources {
  total_clicks: number;
  paid_orders: number;
  conversion_rate: number;
  by_referrer: TrafficReferrer[];
}

export interface BuyerCity {
  city: string;
  country: string;
  lat: number;
  lng: number;
  orders: number;
  tickets: number;
}

export interface BuyerLocations {
  cities: BuyerCity[];
  total_located: number;
  total_paid: number;
}

export const trackingApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['EventTraffic'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventTrafficSources: builder.query<EventTrafficSources, number>({
        query: (eventId) => trackingEndpoints.eventStats(eventId),
        transformResponse: (response: Partial<EventTrafficSources>): EventTrafficSources => ({
          total_clicks: response.total_clicks ?? 0,
          paid_orders: response.paid_orders ?? 0,
          conversion_rate: response.conversion_rate ?? 0,
          by_referrer: response.by_referrer ?? [],
        }),
        providesTags: (_result, _error, eventId) => [{ type: 'EventTraffic', id: eventId }],
      }),
      getEventBuyerLocations: builder.query<BuyerLocations, number>({
        query: (eventId) => trackingEndpoints.buyerLocations(eventId),
        transformResponse: (response: Partial<BuyerLocations>): BuyerLocations => ({
          cities: response.cities ?? [],
          total_located: response.total_located ?? 0,
          total_paid: response.total_paid ?? 0,
        }),
        providesTags: (_result, _error, eventId) => [{ type: 'EventTraffic', id: `locations-${eventId}` }],
      }),
    }),
    overrideExisting: false,
  });

export const { useGetEventTrafficSourcesQuery, useGetEventBuyerLocationsQuery } = trackingApi;
