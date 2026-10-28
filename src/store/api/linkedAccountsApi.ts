import { endpoints } from '@/lib/constants';
import type { AppleSocialPayload } from '@/lib/social-auth';

import { baseApi } from './baseApi';

export interface LinkedAccount {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_image?: string | null;
  nickname?: string | null;
}

export interface SwitchedAccountUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_image?: string | null;
  is_organization?: boolean;
  organization_name?: string | null;
}

export interface SwitchAccountResponse {
  access?: string;
  refresh?: string;
  user?: SwitchedAccountUser | null;
}

export const linkedAccountsApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['LinkedAccounts'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getLinkedAccounts: builder.query<LinkedAccount[], void>({
        query: () => endpoints.linkedAccounts,
        transformResponse: (response: LinkedAccount[] | { results?: LinkedAccount[] }) =>
          Array.isArray(response) ? response : (response?.results ?? []),
        providesTags: ['LinkedAccounts'],
      }),
      switchAccount: builder.mutation<SwitchAccountResponse, number>({
        query: (userId) => ({
          url: `${endpoints.switchAccount}${userId}/`,
          method: 'POST',
        }),
      }),
      unlinkAccount: builder.mutation<unknown, number>({
        query: (linkedUserId) => ({
          url: `${endpoints.linkedAccounts}${linkedUserId}/`,
          method: 'DELETE',
        }),
        invalidatesTags: ['LinkedAccounts'],
      }),
      linkAccountWithOtp: builder.mutation<LinkedAccount, { email: string; otp_code: string; nickname?: string }>({
        query: (body) => ({
          url: `${endpoints.linkedAccounts}link-otp/`,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['LinkedAccounts'],
      }),
      linkAccountWithGoogle: builder.mutation<LinkedAccount, { access_token: string; nickname?: string }>({
        query: (body) => ({
          url: `${endpoints.linkedAccounts}link-google/`,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['LinkedAccounts'],
      }),
      linkAccountWithApple: builder.mutation<
        LinkedAccount,
        Omit<AppleSocialPayload, 'provider'> & { nickname?: string }
      >({
        query: (body) => ({
          url: `${endpoints.linkedAccounts}link-apple/`,
          method: 'POST',
          body,
        }),
        invalidatesTags: ['LinkedAccounts'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetLinkedAccountsQuery,
  useSwitchAccountMutation,
  useUnlinkAccountMutation,
  useLinkAccountWithOtpMutation,
  useLinkAccountWithGoogleMutation,
  useLinkAccountWithAppleMutation,
} = linkedAccountsApi;
