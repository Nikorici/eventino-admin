import { venueEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

const venueEndpoints = {
  eventVenuesByEvent: (eventId: number) => `/api/v1/event-venues/by_event/?event_id=${eventId}`,
  eventZonesByEvent: (eventId: number) => `/api/v1/event-zones/by_event/?event_id=${eventId}`,
} as const;

export interface VenueZone {
  id: number;
  name: string;
  venue: number;
  capacity: number;
  template_slot_id: string;
  color: string;
  display_order: number;
  is_active: boolean;
  comment: string;
}

export interface Venue {
  id: number;
  name: string;
  location: string;
  capacity: number;
  template: string;
  zones: VenueZone[];
}

export interface EventVenue {
  id: number;
  event: number;
  event_name: string;
  venue: number;
  venue_details: Venue;
  configuration_notes: string | null;
}

export interface EventZone {
  id: number;
  event_venue: number;
  zone: number;
  zone_details: VenueZone;
  ticket_type: number;
  ticket_type_name: string | null;
  ticket_type_price: string | null;
  price_override: string | null;
  is_active_override: boolean | null;
}

export type VenueTemplate = 'standard_arena' | 'simple_3' | 'balcon';

export interface CreateVenueBody {
  eventId: number;
  name: string;
  location: string;
  capacity: number;
  template: VenueTemplate;
}

export interface ZonePatch {
  name?: string;
  capacity?: number;
  color?: string;
  display_order?: number;
  is_active?: boolean;
  comment?: string;
}

export interface EventZonePatch {
  ticket_type?: number | null;
  price_override?: number | null;
}

function toList<T>(response: T[] | { results?: T[] }): T[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

function venueTags(eventId: number) {
  return [
    { type: 'EventVenues' as const, id: eventId },
    { type: 'EventZones' as const, id: eventId },
    { type: 'EventDetail' as const, id: eventId },
  ];
}

export const venueApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['EventVenues', 'EventZones'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventVenues: builder.query<EventVenue[], number>({
        query: (eventId) => venueEndpoints.eventVenuesByEvent(eventId),
        transformResponse: (response: EventVenue[] | { results?: EventVenue[] }) => toList(response),
        providesTags: (_result, _error, eventId) => [{ type: 'EventVenues', id: eventId }],
      }),
      getEventZones: builder.query<EventZone[], number>({
        query: (eventId) => venueEndpoints.eventZonesByEvent(eventId),
        transformResponse: (response: EventZone[] | { results?: EventZone[] }) => toList(response),
        providesTags: (_result, _error, eventId) => [{ type: 'EventZones', id: eventId }],
      }),
      createVenue: builder.mutation<Venue, CreateVenueBody>({
        query: ({ eventId: _eventId, ...body }) => ({ url: venueEndpoint.venues, method: 'POST', body }),
      }),
      assignVenueToEvent: builder.mutation<EventVenue, { eventId: number; venueId: number }>({
        query: ({ eventId, venueId }) => ({
          url: venueEndpoint.assignVenue,
          method: 'POST',
          body: { event_id: eventId, venue_id: venueId },
        }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
      deleteVenue: builder.mutation<unknown, { eventId: number; venueId: number }>({
        query: ({ venueId }) => ({ url: venueEndpoint.venue(venueId), method: 'DELETE' }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
      updateZone: builder.mutation<VenueZone, { eventId: number; zoneId: number; patch: ZonePatch }>({
        query: ({ zoneId, patch }) => ({ url: venueEndpoint.zone(zoneId), method: 'PATCH', body: patch }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
      assignZoneToEvent: builder.mutation<EventZone, { eventId: number; eventVenueId: number; zoneId: number; ticketTypeId: number }>({
        query: ({ eventVenueId, zoneId, ticketTypeId }) => ({
          url: venueEndpoint.assignZone,
          method: 'POST',
          body: { event_venue_id: eventVenueId, zone_id: zoneId, ticket_type_id: ticketTypeId },
        }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
      updateEventZone: builder.mutation<EventZone, { eventId: number; eventZoneId: number; patch: EventZonePatch }>({
        query: ({ eventZoneId, patch }) => ({ url: venueEndpoint.eventZone(eventZoneId), method: 'PATCH', body: patch }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
      deleteEventZone: builder.mutation<unknown, { eventId: number; eventZoneId: number }>({
        query: ({ eventZoneId }) => ({ url: venueEndpoint.eventZone(eventZoneId), method: 'DELETE' }),
        invalidatesTags: (_result, _error, { eventId }) => venueTags(eventId),
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetEventVenuesQuery,
  useGetEventZonesQuery,
  useCreateVenueMutation,
  useAssignVenueToEventMutation,
  useDeleteVenueMutation,
  useUpdateZoneMutation,
  useAssignZoneToEventMutation,
  useUpdateEventZoneMutation,
  useDeleteEventZoneMutation,
} = venueApi;
