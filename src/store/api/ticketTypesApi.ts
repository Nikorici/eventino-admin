import { baseApi } from './baseApi';

const ticketTypeEndpoints = {
  byEvent: (eventId: number) => `/api/v1/ticket-types/by-event/?event_id=${eventId}`,
  create: '/api/v1/ticket-types/',
  detail: (ticketTypeId: number) => `/api/v1/ticket-types/${ticketTypeId}/`,
} as const;

export interface ManageTicketType {
  id: number;
  event: number;
  name: string;
  price: string;
  quantity: number | null;
  category?: string | null;
  comment?: string | null;
  qr_code_quantity: number;
  display_order?: number;
  is_table?: boolean;
  show_remaining_tickets?: boolean;
  is_active: boolean;
  sold_count: number;
  remaining: number | null;
  event_day?: string | null;
}

export interface TicketTypePayload {
  name: string;
  price: string;
  quantity: number | null;
  comment: string;
  qr_code_quantity: number;
  is_active: boolean;
  event_day?: string | null;
}

export interface CreateTicketTypeParams extends TicketTypePayload {
  event: number;
}

export interface UpdateTicketTypeParams {
  ticketTypeId: number;
  eventId: number;
  body: Partial<TicketTypePayload>;
}

export interface DeleteTicketTypeParams {
  ticketTypeId: number;
  eventId: number;
}

function toTicketTypeList(response: ManageTicketType[] | { results?: ManageTicketType[] }): ManageTicketType[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const ticketTypesApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['ManageTicketTypes'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getManageTicketTypes: builder.query<ManageTicketType[], number>({
        query: (eventId) => ticketTypeEndpoints.byEvent(eventId),
        transformResponse: toTicketTypeList,
        providesTags: (_result, _error, eventId) => [{ type: 'ManageTicketTypes', id: eventId }],
      }),
      createManageTicketType: builder.mutation<ManageTicketType, CreateTicketTypeParams>({
        query: (body) => ({
          url: ticketTypeEndpoints.create,
          method: 'POST',
          body,
        }),
        invalidatesTags: (_result, _error, { event }) => [{ type: 'ManageTicketTypes', id: event }, { type: 'EventDetail', id: event }],
      }),
      updateManageTicketType: builder.mutation<ManageTicketType, UpdateTicketTypeParams>({
        query: ({ ticketTypeId, body }) => ({
          url: ticketTypeEndpoints.detail(ticketTypeId),
          method: 'PATCH',
          body,
        }),
        invalidatesTags: (_result, _error, { eventId }) => [{ type: 'ManageTicketTypes', id: eventId }, { type: 'EventDetail', id: eventId }],
      }),
      deleteManageTicketType: builder.mutation<unknown, DeleteTicketTypeParams>({
        query: ({ ticketTypeId }) => ({
          url: ticketTypeEndpoints.detail(ticketTypeId),
          method: 'DELETE',
        }),
        invalidatesTags: (_result, _error, { eventId }) => [{ type: 'ManageTicketTypes', id: eventId }, { type: 'EventDetail', id: eventId }],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetManageTicketTypesQuery,
  useCreateManageTicketTypeMutation,
  useUpdateManageTicketTypeMutation,
  useDeleteManageTicketTypeMutation,
} = ticketTypesApi;
