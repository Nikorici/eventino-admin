import { endpoints, eventEndpoint } from '@/lib/constants';
import type { Paginated, User } from '@/types/api';

import { baseApi } from './baseApi';

const organizationsEndpoint = '/api/v1/users/organizations/';
const stripeVerifiedEndpoint = '/api/v1/users/stripe_verified/';
const myDelegatorsEndpoint = '/api/v1/account-delegates/my-delegators/';
const companiesEndpoint = '/api/v1/companies/';

export interface OrganizationResult {
  id: number;
  first_name: string;
  last_name: string;
  organization_name: string | null;
  is_organization: boolean;
  profile_image: string | null;
}

export interface StripeVerificationResponse {
  verified: boolean;
}

export interface CompanySummary {
  id: number;
  user_id: number;
  name: string;
  is_default?: boolean;
}

export interface CompanyGroup {
  user_id: number;
  companies: CompanySummary[];
}

export interface AccountDelegator {
  id: number;
  principal_id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_image: string | null;
  is_organization: boolean;
  organization_name: string | null;
}

export interface GetOrganizationsArgs {
  query: string;
  page: number;
}

export interface UserSearchResult {
  id: number;
  first_name: string;
  last_name: string;
  organization_name: string | null;
  is_organization?: boolean;
  profile_image: string | null;
  is_full_confirmation?: boolean;
  is_email_confirmed?: boolean;
  badge_type?: string;
  short_description?: string | null;
  country?: string | null;
  city?: string | null;
  followers?: { id: number }[];
}

export interface GetUsersArgs {
  search: string;
  page: number;
  pageSize?: number;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUser: builder.query<User, number | string>({
      query: (id) => eventEndpoint.user(id),
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),
    getUsers: builder.query<Paginated<UserSearchResult>, GetUsersArgs>({
      query: ({ search, page, pageSize = 20 }) => ({
        url: endpoints.users,
        params: { search, page, page_size: pageSize },
      }),
    }),
    getOrganizations: builder.query<Paginated<OrganizationResult>, GetOrganizationsArgs>({
      query: ({ query, page }) => ({
        url: organizationsEndpoint,
        params: { query, page },
      }),
    }),
    getStripeVerification: builder.query<StripeVerificationResponse, void>({
      query: () => stripeVerifiedEndpoint,
    }),
    getMyCompanies: builder.query<CompanyGroup[], void>({
      query: () => companiesEndpoint,
    }),
    getMyDelegators: builder.query<AccountDelegator[], void>({
      query: () => myDelegatorsEndpoint,
    }),
    updateUser: builder.mutation<User, { id: number | string; formData: FormData }>({
      query: ({ id, formData }) => ({
        url: eventEndpoint.user(id),
        method: 'PATCH',
        body: formData,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }],
    }),
    followUser: builder.mutation<string, { meId: number; targetId: number }>({
      query: ({ meId, targetId }) => ({
        url: eventEndpoint.userSubscription(meId),
        method: 'POST',
        body: { user_id: targetId, method: 'subscribe' },
        responseHandler: (response) => response.text(),
      }),
      invalidatesTags: (_result, _error, { meId, targetId }) => [
        { type: 'User', id: targetId },
        { type: 'User', id: meId },
      ],
    }),
    unfollowUser: builder.mutation<string, { meId: number; targetId: number }>({
      query: ({ meId, targetId }) => ({
        url: eventEndpoint.userSubscription(meId),
        method: 'POST',
        body: { user_id: targetId, method: 'none' },
        responseHandler: (response) => response.text(),
      }),
      invalidatesTags: (_result, _error, { meId, targetId }) => [
        { type: 'User', id: targetId },
        { type: 'User', id: meId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUserQuery,
  useLazyGetUserQuery,
  useGetUsersQuery,
  useLazyGetOrganizationsQuery,
  useLazyGetStripeVerificationQuery,
  useGetMyCompaniesQuery,
  useGetMyDelegatorsQuery,
  useUpdateUserMutation,
  useFollowUserMutation,
  useUnfollowUserMutation,
} = usersApi;
