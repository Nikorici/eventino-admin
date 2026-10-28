import { API_KEY, endpoints, eventEndpoint } from '@/lib/constants';
import {
  buildCreateEventBody,
  buildUpdateEventBody,
  type CreateEventInput,
  type UpdateEventInput,
} from '@/lib/eventFormBody';
import type {
  Category,
  CategoryGroup,
  DiscoverFilters,
  EventDetail,
  EventListItem,
  Paginated,
} from '@/types/api';

import { baseApi } from './baseApi';

export type {
  CreateEventInput,
  EventCouponInput,
  EventLocationType,
  EventMediaOrderEntry,
  EventOrganizerInput,
  EventQuestionInput,
  EventScalarInput,
  EventTicketTypeInput,
  EventTimelineInput,
  MultipartFile,
  UpdateEventInput,
} from '@/lib/eventFormBody';

export interface GetEventsParams {
  page?: number | 'no-page';
  search?: string;
  category?: number[];
  filters?: Partial<DiscoverFilters>;
  page_size?: number;
  region?: string;
  country?: string;
  ordering?: string;
}

export interface CreateEventResponse {
  id: number;
  slug: string;
  title: string;
}

function buildEventsQuery(params: GetEventsParams): string {
  const { page = 1, search = '', category = [], filters = {}, page_size, region = '' } = params;
  const qs = new URLSearchParams();
  qs.append('search', search);
  qs.append('category', category.join(','));
  qs.append('start_time', filters.start_time ?? '');
  qs.append('start_date', filters.start_date ?? '');
  qs.append('end_date', filters.end_date ?? '');
  qs.append('end_time', filters.end_time ?? '');
  qs.append('type', filters.type ?? '');
  qs.append('country', filters.country ?? params.country ?? '');
  qs.append('region', filters.region ?? region);
  if (params.ordering) qs.append('ordering', params.ordering);
  if (page !== 'no-page') qs.append('page', String(page));
  if (page_size) qs.append('page_size', String(page_size));
  return qs.toString();
}

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEvents: builder.query<Paginated<EventListItem>, GetEventsParams>({
      query: (params) => `${endpoints.events}?${buildEventsQuery(params)}`,
      providesTags: ['Event'],
    }),
    getEventDetail: builder.query<EventDetail, number | string>({
      query: (id) => eventEndpoint.detail(id),
      providesTags: (_result, _error, id) => [{ type: 'EventDetail', id: Number(id) }],
    }),
    getFeaturedEvents: builder.query<EventListItem[], string | void>({
      query: (country) => `${endpoints.featuredEvents}${country ? `?country=${encodeURIComponent(country)}` : ''}`,
      providesTags: ['Featured'],
    }),
    getHomeFeed: builder.query<CategoryGroup[], string | void>({
      query: (country) => ({
        url: `${endpoints.newEvents}${country ? `?country=${encodeURIComponent(country)}` : ''}`,
        headers: { Authorization: `Api-Key ${API_KEY}` },
      }),
      providesTags: ['HomeFeed'],
    }),
    getCategories: builder.query<Category[], void>({
      query: () => endpoints.categories,
      transformResponse: (response: Category[] | { results: Category[] }) =>
        Array.isArray(response) ? response : (response.results ?? []),
      providesTags: ['Category'],
    }),
    getCountries: builder.query<string[], void>({
      query: () => endpoints.countries,
    }),
    createEvent: builder.mutation<CreateEventResponse, CreateEventInput>({
      query: (input) => ({
        url: endpoints.events,
        method: 'POST',
        body: buildCreateEventBody(input),
      }),
      invalidatesTags: ['Event', 'HomeFeed', 'Featured'],
    }),
    updateEvent: builder.mutation<CreateEventResponse, UpdateEventInput>({
      query: (input) => ({
        url: eventEndpoint.detail(input.id),
        method: 'PATCH',
        body: buildUpdateEventBody(input),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'Event',
        'HomeFeed',
        'Featured',
        { type: 'EventDetail', id: Number(id) },
      ],
    }),
    deleteEvent: builder.mutation<string, number>({
      query: (id) => ({
        url: eventEndpoint.detail(id),
        method: 'DELETE',
        responseHandler: (response) => response.text(),
      }),
      invalidatesTags: (_result, _error, id) => [
        'Event',
        'HomeFeed',
        'Featured',
        { type: 'EventDetail', id: Number(id) },
      ],
    }),
    answerEventQuestions: builder.mutation<
      unknown,
      { eventId: number; question_responses: Record<string, string | string[]>; skipped_required_question_ids?: number[] }
    >({
      query: ({ eventId, ...body }) => ({
        url: eventEndpoint.answerQuestions(eventId),
        method: 'POST',
        body,
      }),
    }),
    toggleEventSubscription: builder.mutation<string, { id: number; method: 'subscribe' | 'none' }>({
      query: ({ id, method }) => ({
        url: eventEndpoint.subscription(id),
        method: 'POST',
        body: { method },
        responseHandler: (response) => response.text(),
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'EventDetail', id: Number(id) }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEventsQuery,
  useLazyGetEventsQuery,
  useGetEventDetailQuery,
  useGetFeaturedEventsQuery,
  useGetHomeFeedQuery,
  useGetCategoriesQuery,
  useGetCountriesQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useAnswerEventQuestionsMutation,
  useToggleEventSubscriptionMutation,
} = eventsApi;
