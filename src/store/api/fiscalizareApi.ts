import { baseApi } from './baseApi';

const fiscalizareEndpoints = {
  fiscalizationEvents: '/api/v1/events/fiscalization-events/',
  user: (id: number | string) => `/api/v1/users/${id}/`,
} as const;

export const fiscalizationDownloadEndpoint = {
  formular: (eventId: number | string) => `/api/v1/users/fiscalization_pdf/?event_id=${eventId}`,
  taxDeclaration: (eventId: number | string) => `/api/v1/users/tax_declaration_pdf/?event_id=${eventId}`,
  procesVerbal: (eventId: number | string) => `/api/v1/users/proces_verbal_pdf/?event_id=${eventId}`,
} as const;

export type CommissionPayer = 'ORGANIZER' | 'BUYER';

export interface FiscalizationEvent {
  id: number;
  title?: string | null;
  slug?: string | null;
  start_date?: string | null;
  country?: string | null;
  currency?: string | null;
}

export interface FiscalizationCompany {
  company_name: string;
  company_cui: string;
  company_registration_number: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_pays_tva: boolean;
  company_iban: string;
  commission_paid_by: CommissionPayer;
}

export interface FiscalizationProfile {
  id: number;
  company_name?: string | null;
  company_cui?: string | null;
  company_registration_number?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_pays_tva?: boolean | null;
  company_iban?: string | null;
  commission_paid_by?: string | null;
  eventino_commission_percent?: number | string | null;
}

export interface UpdateFiscalizationCompanyArgs {
  id: number | string;
  company: FiscalizationCompany;
}

function toEventList(
  response: FiscalizationEvent[] | { results?: FiscalizationEvent[] },
): FiscalizationEvent[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const fiscalizareApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['FiscalizationEvents', 'FiscalizationProfile'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getFiscalizationEvents: builder.query<FiscalizationEvent[], void>({
        query: () => fiscalizareEndpoints.fiscalizationEvents,
        transformResponse: toEventList,
        providesTags: ['FiscalizationEvents'],
      }),
      getFiscalizationProfile: builder.query<FiscalizationProfile, number | string>({
        query: (id) => fiscalizareEndpoints.user(id),
        providesTags: (_result, _error, id) => [{ type: 'FiscalizationProfile', id }],
      }),
      updateFiscalizationCompany: builder.mutation<FiscalizationProfile, UpdateFiscalizationCompanyArgs>({
        query: ({ id, company }) => ({
          url: fiscalizareEndpoints.user(id),
          method: 'PATCH',
          body: company,
        }),
        invalidatesTags: (_result, _error, { id }) => [
          { type: 'FiscalizationProfile', id },
          { type: 'User', id },
        ],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetFiscalizationEventsQuery,
  useGetFiscalizationProfileQuery,
  useUpdateFiscalizationCompanyMutation,
} = fiscalizareApi;
