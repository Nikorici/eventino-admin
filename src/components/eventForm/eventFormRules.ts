import { extractApiError } from '@/lib/apiError';
import type { QuantityDiscountTier } from '@/types/api';

export const MAX_QUANTITY_DISCOUNT_TIERS = 10;

export interface QuantityDiscountRow {
  min_quantity: string;
  percent: string;
}

export type QuantityDiscountError = 'minQuantity' | 'percent' | 'duplicate' | 'tooMany';

export const QUANTITY_DISCOUNT_ERROR_MESSAGES: Record<QuantityDiscountError, string> = {
  minQuantity: 'A quantity discount must start from at least 2 tickets',
  percent: 'A quantity discount must be a whole number between 1% and 99%',
  duplicate: 'Each quantity discount needs a different number of tickets',
  tooMany: 'Too many quantity discount tiers',
};

export function validateQuantityDiscountTiers(rows: QuantityDiscountRow[]): {
  error: QuantityDiscountError | null;
  tiers: QuantityDiscountTier[] | null;
} {
  const filled = rows.filter((row) => row.min_quantity.trim() !== '' || row.percent.trim() !== '');
  if (filled.length > MAX_QUANTITY_DISCOUNT_TIERS) return { error: 'tooMany', tiers: null };

  const seen = new Set<number>();
  const tiers: QuantityDiscountTier[] = [];
  for (const row of filled) {
    const minQuantity = Number(row.min_quantity);
    const percent = Number(row.percent);
    if (!Number.isInteger(minQuantity) || minQuantity < 2) return { error: 'minQuantity', tiers: null };
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) return { error: 'percent', tiers: null };
    if (seen.has(minQuantity)) return { error: 'duplicate', tiers: null };
    seen.add(minQuantity);
    tiers.push({ min_quantity: minQuantity, percent });
  }

  tiers.sort((a, b) => a.min_quantity - b.min_quantity);
  return { error: null, tiers: tiers.length > 0 ? tiers : null };
}

export function nextQuantityDiscountRow(rows: QuantityDiscountRow[]): QuantityDiscountRow {
  const lastMin = Number(rows[rows.length - 1]?.min_quantity) || 0;
  return { min_quantity: String(lastMin ? lastMin + 2 : 3), percent: '' };
}

export type MeetingPlatform = 'zoom' | 'google_meet' | 'other';

export function detectMeetingPlatform(link: string): MeetingPlatform {
  if (/^https:\/\/([\w-]+\.)?zoom.us\/(j|meeting|s)\//i.test(link)) return 'zoom';
  if (/^https:\/\/meet.google.com\//i.test(link)) return 'google_meet';
  return 'other';
}

export type PaymentSetupKind = 'maib' | 'netopia' | 'stripe';

export interface PaymentSetupInput {
  hasPaidTickets: boolean;
  country: string;
  currency: string;
  contractSigned: boolean;
  stripeConnected: boolean;
}

export function isMoldovaCountry(country: string): boolean {
  const normalized = country.toLowerCase();
  return normalized.includes('moldova') || normalized.includes('md');
}

export function requiredPaymentSetup(input: PaymentSetupInput): PaymentSetupKind | null {
  if (!input.hasPaidTickets) return null;
  if (isMoldovaCountry(input.country)) return input.contractSigned ? null : 'maib';
  if (input.currency === 'RON') return input.contractSigned ? null : 'netopia';
  if (input.currency !== 'MDL' && !input.stripeConnected) return 'stripe';
  return null;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

function datePart(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timePart(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function defaultEventSchedule(now: Date): { startDate: string; startTime: string; endDate: string; endTime: string } {
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  return { startDate: datePart(now), startTime: timePart(now), endDate: datePart(end), endTime: timePart(end) };
}

type Translate = (key: string) => string;

function submitErrorStatus(error: unknown): number | string | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  if ('originalStatus' in error && typeof error.originalStatus === 'number') return error.originalStatus;
  return typeof error.status === 'number' || typeof error.status === 'string' ? error.status : undefined;
}

export function describeEventSubmitError(error: unknown, t: Translate): string | undefined {
  const backendMessage = extractApiError(error)?.trim();
  if (backendMessage && !backendMessage.startsWith('<')) return backendMessage;
  const status = submitErrorStatus(error);
  if (status === 413) return t('Files too large. Please reduce image or video size and try again.');
  if (status === 401 || status === 403) return t('Session expired. Please log in again.');
  if (status === 408 || status === 504 || status === 'TIMEOUT_ERROR') return t('Upload timed out. Try smaller files or a faster connection.');
  if (status === 502 || status === 503) return t('Server is temporarily unavailable. Please try again in a moment.');
  if (typeof status === 'number' && status >= 500) return `${t('Server error')} (${status}). ${t('Please try again later.')}`;
  if (typeof status === 'number') return `${t('Request failed')} (${status})`;
  if (status === 'FETCH_ERROR') return t('Network error. Check your internet connection and try again.');
  return undefined;
}
