import { baseApi } from './baseApi';

const scannerEndpoints = {
  list: '/api/v1/event_scanners/',
  detail: (scannerId: number) => `/api/v1/event_scanners/${scannerId}/`,
  ticketTypes: '/api/v1/event_scanners/ticket-types/',
  availableUsers: '/api/v1/event_scanners/available-users/',
  invite: '/api/v1/event_scanners/invite/',
} as const;

export interface ScannerTicketType {
  id: number;
  name: string;
  is_archived?: boolean;
}

export interface ScannerUserDetails {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  is_organization?: boolean;
  organization_name?: string | null;
}

export interface EventScanner {
  id: number;
  event: number;
  user: number;
  user_details: ScannerUserDetails;
  added_at: string;
  scan_all: boolean;
  ticket_types: ScannerTicketType[];
  is_pending_invite?: boolean;
  invite_email?: string | null;
  invite_sent_at?: string | null;
  invite_accepted_at?: string | null;
}

export interface AvailableScannerUser {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_staff?: boolean;
}

export interface ScannerScope {
  scan_all: boolean;
  ticket_type_ids: number[];
}

export interface AddEventScannerBody extends ScannerScope {
  event: number;
  user: number;
}

export interface UpdateScannerScopeBody {
  scannerId: number;
  scope: ScannerScope;
}

export interface InviteScannerBody extends ScannerScope {
  event: number;
  email: string;
}

export interface InviteScannerResponse extends EventScanner {
  account_created?: boolean;
  invite_sent?: boolean;
}

export interface AvailableScannerUsersParams {
  eventId: number;
  search: string;
  limit?: number;
}

export const scannersApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['EventScanners', 'AvailableScannerUsers'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventScanners: builder.query<EventScanner[], number>({
        query: (eventId) => `${scannerEndpoints.list}?event_id=${eventId}`,
        transformResponse: (response: EventScanner[] | { results?: EventScanner[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: ['EventScanners'],
      }),
      addEventScanner: builder.mutation<EventScanner, AddEventScannerBody>({
        query: (body) => ({
          url: scannerEndpoints.list,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['EventScanners', 'AvailableScannerUsers'],
      }),
      updateEventScannerScope: builder.mutation<EventScanner, UpdateScannerScopeBody>({
        query: ({ scannerId, scope }) => ({
          url: scannerEndpoints.detail(scannerId),
          method: 'PATCH',
          body: scope,
        }),
        invalidatesTags: ['EventScanners'],
      }),
      removeEventScanner: builder.mutation<unknown, number>({
        query: (scannerId) => ({
          url: scannerEndpoints.detail(scannerId),
          method: 'DELETE',
        }),
        invalidatesTags: ['EventScanners', 'AvailableScannerUsers'],
      }),
      getScannerTicketTypes: builder.query<ScannerTicketType[], number>({
        query: (eventId) => `${scannerEndpoints.ticketTypes}?event_id=${eventId}`,
        transformResponse: (response: ScannerTicketType[] | { results?: ScannerTicketType[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
      }),
      searchAvailableScannerUsers: builder.query<AvailableScannerUser[], AvailableScannerUsersParams>({
        query: ({ eventId, search, limit = 10 }) =>
          `${scannerEndpoints.availableUsers}?event_id=${eventId}&q=${encodeURIComponent(search)}&limit=${limit}`,
        providesTags: ['AvailableScannerUsers'],
      }),
      inviteScannerByEmail: builder.mutation<InviteScannerResponse, InviteScannerBody>({
        query: (body) => ({
          url: scannerEndpoints.invite,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['EventScanners', 'AvailableScannerUsers'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetEventScannersQuery,
  useAddEventScannerMutation,
  useUpdateEventScannerScopeMutation,
  useRemoveEventScannerMutation,
  useGetScannerTicketTypesQuery,
  useSearchAvailableScannerUsersQuery,
  useInviteScannerByEmailMutation,
} = scannersApi;
