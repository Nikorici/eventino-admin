import { bnmDate, parseBnmRates, type ExchangeRates } from '@/lib/currency';

import { baseApi } from './baseApi';

export const bnmRatesEndpoint = 'https://bnm.md/ro/official_exchange_rates';

export const currencyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExchangeRates: builder.query<ExchangeRates, void>({
      query: () => ({
        url: bnmRatesEndpoint,
        params: { get_xml: 1, date: bnmDate(new Date()) },
        responseHandler: 'text',
      }),
      transformResponse: (response: string) => parseBnmRates(response),
      keepUnusedDataFor: 6 * 60 * 60,
    }),
  }),
});

export const { useGetExchangeRatesQuery } = currencyApi;
