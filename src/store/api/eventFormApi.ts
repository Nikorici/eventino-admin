import { baseApi } from './baseApi';

export type PaymentProcessor = 'maib' | 'netopia';

export interface SignContractInput {
  legalEntityName: string;
  legalRepresentativeName: string;
  legalEntityAddress: string;
  legalEntityIban: string;
  legalEntityIdno?: string;
  legalEntityCui?: string;
  paymentProcessor: PaymentProcessor;
}

export interface StripeConnectResponse {
  onboard_link: string;
}

export const eventFormApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    signContract: builder.mutation<unknown, SignContractInput>({
      query: (body) => ({ url: '/api/v1/users/sign_contract/', method: 'POST', body }),
    }),
    getStripeConnectUrl: builder.mutation<StripeConnectResponse, void>({
      query: () => ({ url: '/api/v1/users/stripe_connect/', method: 'POST' }),
    }),
  }),
});

export const { useSignContractMutation, useGetStripeConnectUrlMutation } = eventFormApi;
