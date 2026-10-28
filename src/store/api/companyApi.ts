import { eventEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

export interface CompanyFields {
  company_name: string;
  company_cui: string;
  company_registration_number: string;
  company_address: string;
  company_postal_code: string;
  company_county: string;
  company_phone: string;
  company_email: string;
  company_iban: string;
}

export interface CompanyProfile extends Partial<CompanyFields> {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateCompanyProfileArgs {
  userId: number;
  company: CompanyFields;
}

export const companyApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['CompanyProfile'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getCompanyProfile: builder.query<CompanyProfile, number>({
        query: (userId) => eventEndpoint.user(userId),
        providesTags: (_result, _error, userId) => [{ type: 'CompanyProfile', id: userId }],
      }),
      updateCompanyProfile: builder.mutation<CompanyProfile, UpdateCompanyProfileArgs>({
        query: ({ userId, company }) => ({
          url: eventEndpoint.user(userId),
          method: 'PATCH',
          body: company,
        }),
        invalidatesTags: (_result, _error, { userId }) => [
          { type: 'CompanyProfile', id: userId },
          { type: 'User', id: userId },
        ],
      }),
    }),
    overrideExisting: false,
  });

export const { useGetCompanyProfileQuery, useUpdateCompanyProfileMutation } = companyApi;
