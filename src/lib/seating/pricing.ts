import { formatMoney } from '@/lib/pricing';
import { currencySymbol } from '@/theme/colors';

export function parsePrice(price: string | number): number {
  const value = typeof price === 'number' ? price : Number(price);
  return Number.isFinite(value) ? value : 0;
}

export function selectionTotal(seats: { price: string | number }[]): number {
  const cents = seats.reduce((sum, seat) => sum + Math.round(parsePrice(seat.price) * 100), 0);
  return cents / 100;
}

export function formatPrice(amount: number, currency: string): string {
  return `${formatMoney(amount)} ${currencySymbol(currency)}`.trim();
}
