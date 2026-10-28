import { formatPrice, parsePrice, selectionTotal } from './pricing';

describe('seating pricing', () => {
  it('parses string and numeric prices', () => {
    expect(parsePrice('900.00')).toBe(900);
    expect(parsePrice(12.5)).toBe(12.5);
    expect(parsePrice('abc')).toBe(0);
  });

  it('sums a selection without floating point drift', () => {
    expect(selectionTotal([{ price: '900.00' }, { price: '500.00' }, { price: '0.10' }, { price: '0.20' }])).toBe(1400.3);
    expect(selectionTotal([])).toBe(0);
  });

  it('formats prices with the currency symbol', () => {
    expect(formatPrice(1800, 'MDL')).toBe('1800 MDL');
    expect(formatPrice(12.5, 'EUR')).toBe('12.50 €');
    expect(formatPrice(3, '')).toBe('3');
  });
});
