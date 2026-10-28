import { baseApi } from './baseApi';

const staffEndpoints = {
  list: '/api/v1/event_staff/',
  detail: (staffId: number) => `/api/v1/event_staff/${staffId}/`,
  availableUsers: '/api/v1/event_staff/available-users/',
  myPermissions: '/api/v1/event_staff/my-permissions/',
} as const;

export type StaffAccessLevel = 'full' | 'view_only';

export interface StaffPermissionFlags {
  can_view_buyers: boolean;
  can_view_analytics: boolean;
  can_manage_tickets: boolean;
  can_manage_orders: boolean;
  can_manage_forms: boolean;
  can_manage_scanners: boolean;
}

export interface StaffPermissions extends StaffPermissionFlags {
  permission: StaffAccessLevel;
}

export interface StaffUserDetails {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  is_organization?: boolean;
  organization_name?: string | null;
}

export interface EventStaffMember extends StaffPermissions {
  id: number;
  event: number;
  user: number;
  added_at: string;
  user_details: StaffUserDetails;
}

export type AvailableStaffUser = StaffUserDetails;

export interface MyStaffPermissions extends Partial<StaffPermissions> {
  is_staff_member: boolean;
}

export interface AddEventStaffBody extends StaffPermissions {
  event: number;
  user: number;
}

export interface UpdateEventStaffBody {
  staffId: number;
  permissions: StaffPermissions;
}

export interface AvailableUsersParams {
  eventId: number;
  search: string;
  limit?: number;
}

export const staffApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['EventStaff', 'AvailableStaffUsers'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getEventStaff: builder.query<EventStaffMember[], number>({
        query: (eventId) => `${staffEndpoints.list}?event_id=${eventId}`,
        transformResponse: (response: EventStaffMember[] | { results?: EventStaffMember[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: ['EventStaff'],
      }),
      addEventStaff: builder.mutation<EventStaffMember, AddEventStaffBody>({
        query: (body) => ({
          url: staffEndpoints.list,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['EventStaff', 'AvailableStaffUsers'],
      }),
      updateEventStaff: builder.mutation<EventStaffMember, UpdateEventStaffBody>({
        query: ({ staffId, permissions }) => ({
          url: staffEndpoints.detail(staffId),
          method: 'PATCH',
          body: permissions,
        }),
        invalidatesTags: ['EventStaff'],
      }),
      removeEventStaff: builder.mutation<unknown, number>({
        query: (staffId) => ({
          url: staffEndpoints.detail(staffId),
          method: 'DELETE',
        }),
        invalidatesTags: ['EventStaff', 'AvailableStaffUsers'],
      }),
      searchAvailableStaffUsers: builder.query<AvailableStaffUser[], AvailableUsersParams>({
        query: ({ eventId, search, limit = 10 }) =>
          `${staffEndpoints.availableUsers}?event_id=${eventId}&q=${encodeURIComponent(search)}&limit=${limit}`,
        providesTags: ['AvailableStaffUsers'],
      }),
      getMyStaffPermissions: builder.query<MyStaffPermissions, number>({
        query: (eventId) => `${staffEndpoints.myPermissions}?event_id=${eventId}`,
        providesTags: ['EventStaff'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetEventStaffQuery,
  useAddEventStaffMutation,
  useUpdateEventStaffMutation,
  useRemoveEventStaffMutation,
  useSearchAvailableStaffUsersQuery,
  useGetMyStaffPermissionsQuery,
} = staffApi;
