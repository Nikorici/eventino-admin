export interface ExchangeRates {
  rates: Record<string, number>;
  nominals: Record<string, number>;
}

export const SUMMARY_CURRENCIES = [
  { code: 'MDL', name: 'Moldovan Leu' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'RON', name: 'Romanian Leu' },
] as const;

export const FALLBACK_RATES: ExchangeRates = {
  rates: { MDL: 1, USD: 17.4208, EUR: 20.2029, RON: 3.8609 },
  nominals: { MDL: 1, USD: 1, EUR: 1, RON: 1 },
};

const VALUTE = /<CharCode>(.*?)<\/CharCode>[\s\S]*?<Nominal>(.*?)<\/Nominal>[\s\S]*?<Value>(.*?)<\/Value>/g;

export function parseBnmRates(xml: string): ExchangeRates {
  const rates: Record<string, number> = { MDL: 1 };
  const nominals: Record<string, number> = { MDL: 1 };
  for (const [, code, nominal, value] of xml.matchAll(VALUTE)) {
    const rate = parseFloat(value.replace(',', '.'));
    if (code && !Number.isNaN(rate)) {
      rates[code] = rate;
      nominals[code] = parseInt(nominal, 10) || 1;
    }
  }
  return rates.USD ? { rates, nominals } : FALLBACK_RATES;
}

export function bnmDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

export function convertAmount(amount: number, from: string, to: string, { rates, nominals }: ExchangeRates): number {
  if (!amount) return 0;
  if (from === to) return amount;
  const amountInMdl = from === 'MDL' ? amount : (amount * rates[from]) / nominals[from];
  return to === 'MDL' ? amountInMdl : (amountInMdl * nominals[to]) / rates[to];
}

export function sumInCurrency(byCurrency: Record<string, number> | undefined, to: string, rates: ExchangeRates): number {
  return Object.entries(byCurrency ?? {}).reduce((total, [from, amount]) => total + convertAmount(amount, from, to, rates), 0);
}

export function groupThousands(value: number, fractionDigits = 0): string {
  const [whole, fraction] = Math.abs(value).toFixed(fractionDigits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}
