import { bnmDate, convertAmount, groupThousands, parseBnmRates, sumInCurrency } from './currency';

const rates = { rates: { MDL: 1, RON: 3.86, EUR: 19.4, USD: 17.6, RUB: 21.5 }, nominals: { MDL: 1, RON: 1, EUR: 1, USD: 1, RUB: 100 } };

describe('currency', () => {
  it('parses the BNM XML with nominals and comma decimals', () => {
    const xml =
      '<ValCurs><Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>17,60</Value></Valute>' +
      '<Valute><CharCode>RUB</CharCode><Nominal>100</Nominal><Value>21.5</Value></Valute></ValCurs>';
    expect(parseBnmRates(xml)).toEqual({ rates: { MDL: 1, USD: 17.6, RUB: 21.5 }, nominals: { MDL: 1, USD: 1, RUB: 100 } });
  });

  it('converts through MDL like the web CurrencyContext', () => {
    expect(convertAmount(100, 'RON', 'MDL', rates)).toBeCloseTo(386);
    expect(convertAmount(386, 'MDL', 'RON', rates)).toBeCloseTo(100);
    expect(convertAmount(100, 'RUB', 'MDL', rates)).toBeCloseTo(21.5);
    expect(convertAmount(10, 'EUR', 'EUR', rates)).toBe(10);
  });

  it('sums every currency into one amount', () => {
    expect(sumInCurrency({ MDL: 1000, RON: 100, EUR: 10 }, 'MDL', rates)).toBeCloseTo(1000 + 386 + 194);
    expect(sumInCurrency(undefined, 'MDL', rates)).toBe(0);
  });

  it('formats with thousands separators', () => {
    expect(groupThousands(1884273.6, 2)).toBe('1,884,273.60');
    expect(groupThousands(412500)).toBe('412,500');
    expect(groupThousands(-1234.5, 2)).toBe('-1,234.50');
    expect(bnmDate(new Date(2026, 9, 8))).toBe('08.10.2026');
  });
});
