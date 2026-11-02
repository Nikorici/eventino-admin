import { useCallback, useEffect, useMemo, useState } from 'react';

import { STORAGE_KEYS } from '@/lib/constants';
import { FALLBACK_RATES, sumInCurrency } from '@/lib/currency';
import { cache } from '@/lib/storage';
import { useGetExchangeRatesQuery } from '@/store/api/currencyApi';

export function useSummaryCurrency(eventCurrencies: string[], skip: boolean) {
  const { data: fetchedRates, refetch: refetchRates } = useGetExchangeRatesQuery(undefined, { skip });
  const [storedCurrency, setStoredCurrency] = useState<string | null>(null);

  useEffect(() => {
    void cache.get<string>(STORAGE_KEYS.defaultCurrency).then(setStoredCurrency);
  }, []);

  const isMixed = eventCurrencies.length > 1;
  const currency = isMixed ? (storedCurrency ?? eventCurrencies[0]) : (eventCurrencies[0] ?? storedCurrency ?? 'MDL');
  const rates = useMemo(
    () => ({
      rates: { ...FALLBACK_RATES.rates, ...fetchedRates?.rates },
      nominals: { ...FALLBACK_RATES.nominals, ...fetchedRates?.nominals },
    }),
    [fetchedRates],
  );

  const chooseCurrency = useCallback((code: string) => {
    setStoredCurrency(code);
    void cache.set(STORAGE_KEYS.defaultCurrency, code);
  }, []);

  const total = useCallback(
    (byCurrency: Record<string, number> | undefined) =>
      isMixed ? sumInCurrency(byCurrency, currency, rates) : (byCurrency?.[currency] ?? 0),
    [isMixed, currency, rates],
  );

  return { currency, isMixed, rates, chooseCurrency, refetchRates, total };
}

export type SummaryCurrency = ReturnType<typeof useSummaryCurrency>;
