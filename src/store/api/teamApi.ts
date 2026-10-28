import { baseApi } from './baseApi';

const teamEndpoints = {
  delegates: '/api/v1/account-delegates/',
  delegateDetail: (delegateId: number) => `/api/v1/account-delegates/${delegateId}/`,
  availableUsers: '/api/v1/account-delegates/available-users/',
} as const;

export interface DelegatePermissionFlags {
  can_edit: boolean;
  can_post: boolean;
  can_delete: boolean;
}

export interface DelegateUserDetails {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_image?: string | null;
  is_organization?: boolean;
  organization_name?: string | null;
}

export interface AccountDelegate extends DelegatePermissionFlags {
  id: number;
  principal: number;
  delegate: number;
  principal_details: DelegateUserDetails;
  delegate_details: DelegateUserDetails;
  created_at: string;
}

export type AvailableDelegateUser = DelegateUserDetails;

export interface AddDelegateBody extends DelegatePermissionFlags {
  delegate: number;
}

export interface UpdateDelegateBody {
  delegateId: number;
  permissions: DelegatePermissionFlags;
}

export interface DelegateSearchParams {
  search: string;
  limit?: number;
}

export const teamApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Delegates', 'AvailableDelegateUsers'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMyDelegates: builder.query<AccountDelegate[], void>({
        query: () => `${teamEndpoints.delegates}?role=principal`,
        transformResponse: (response: AccountDelegate[] | { results?: AccountDelegate[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: ['Delegates'],
      }),
      addDelegate: builder.mutation<AccountDelegate, AddDelegateBody>({
        query: (body) => ({
          url: teamEndpoints.delegates,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['Delegates', 'AvailableDelegateUsers'],
      }),
      updateDelegate: builder.mutation<AccountDelegate, UpdateDelegateBody>({
        query: ({ delegateId, permissions }) => ({
          url: teamEndpoints.delegateDetail(delegateId),
          method: 'PATCH',
          body: permissions,
        }),
        invalidatesTags: ['Delegates'],
      }),
      removeDelegate: builder.mutation<unknown, number>({
        query: (delegateId) => ({
          url: teamEndpoints.delegateDetail(delegateId),
          method: 'DELETE',
        }),
        invalidatesTags: ['Delegates', 'AvailableDelegateUsers'],
      }),
      searchAvailableDelegateUsers: builder.query<AvailableDelegateUser[], DelegateSearchParams>({
        query: ({ search, limit = 10 }) =>
          `${teamEndpoints.availableUsers}?q=${encodeURIComponent(search)}&limit=${limit}`,
        providesTags: ['AvailableDelegateUsers'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetMyDelegatesQuery,
  useAddDelegateMutation,
  useUpdateDelegateMutation,
  useRemoveDelegateMutation,
  useSearchAvailableDelegateUsersQuery,
} = teamApi;
