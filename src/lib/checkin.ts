import { formatMoney } from '@/lib/pricing';
import { isRefundedOrder } from '@/lib/refunds';
import type { AccountTicket, CheckInStatus, WalletState } from '@/store/api/checkinApi';

export const MIN_CHECK_IN_AGE = 5;
export const MAX_CHECK_IN_AGE = 120;

export const CHECK_IN_CONFIRMED_STATUSES: CheckInStatus[] = ['SUBMITTED', 'APPROVED'];

export type CheckInTone = 'required' | 'pending' | 'submitted' | 'approved' | 'rejected';

export const CHECK_IN_STATUS_CONFIG: Record<CheckInStatus, { tone: CheckInTone; label: string }> = {
  NONE: { tone: 'required', label: 'Check-in required' },
  PENDING: { tone: 'pending', label: 'Check-in in progress' },
  SUBMITTED: { tone: 'submitted', label: 'Check-in submitted' },
  APPROVED: { tone: 'approved', label: 'Checked in' },
  REJECTED: { tone: 'rejected', label: 'Check-in rejected' },
};

export function normalizeCheckInStatus(status?: string | null): CheckInStatus {
  const value = String(status ?? 'NONE').toUpperCase();
  return value in CHECK_IN_STATUS_CONFIG ? (value as CheckInStatus) : 'NONE';
}

export function isCheckInConfirmed(status?: string | null): boolean {
  return CHECK_IN_CONFIRMED_STATUSES.includes(normalizeCheckInStatus(status));
}

export function todayISODate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseISODate(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

export function calculateAge(birthDate: Date, reference = new Date()): number {
  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

export interface CheckInFieldErrors {
  full_name?: string;
  date_of_birth?: string;
  selfie?: string;
}

export interface CheckInFieldInput {
  fullName: string;
  dateOfBirth: string;
  hasSelfie: boolean;
  selfieRequired: boolean;
  now?: Date;
}

export function validateCheckInFields({ fullName, dateOfBirth, hasSelfie, selfieRequired, now = new Date() }: CheckInFieldInput): CheckInFieldErrors {
  const errors: CheckInFieldErrors = {};

  const trimmedName = fullName.trim();
  if (trimmedName.length < 3 || !/\s/.test(trimmedName)) {
    errors.full_name = 'Please enter your first and last name.';
  }

  const parsedDate = parseISODate(dateOfBirth);
  if (!dateOfBirth) {
    errors.date_of_birth = 'Please enter your date of birth.';
  } else if (!parsedDate) {
    errors.date_of_birth = 'Please enter a valid date of birth.';
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsedDate.getTime() > today.getTime()) {
      errors.date_of_birth = 'Your date of birth cannot be in the future.';
    } else {
      const age = calculateAge(parsedDate, now);
      if (age < MIN_CHECK_IN_AGE || age > MAX_CHECK_IN_AGE) {
        errors.date_of_birth = 'Please check your date of birth.';
      }
    }
  }

  if (selfieRequired && !hasSelfie) {
    errors.selfie = 'Please add a photo of yourself.';
  }

  return errors;
}

function flattenServerMessage(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return flattenServerMessage(value[0]);
  if (typeof value === 'object') return flattenServerMessage(Object.values(value as Record<string, unknown>)[0]);
  return String(value);
}

export function mapServerFieldErrors(serverErrors: unknown): CheckInFieldErrors {
  if (!serverErrors || typeof serverErrors !== 'object') return {};
  const source = serverErrors as Record<string, unknown>;
  const errors: CheckInFieldErrors = {};
  (['full_name', 'date_of_birth', 'selfie'] as const).forEach((field) => {
    const message = flattenServerMessage(source[field]);
    if (message) errors[field] = message;
  });
  return errors;
}

export const TOP_UP_PRESETS = [50, 100, 200, 500];

export const TOP_UP_ERROR_MESSAGES: Record<string, string> = {
  topup_disabled: 'Top-ups are not available for this event.',
  amount_out_of_range: 'That amount is not allowed. Please choose a different amount.',
  currency_not_supported: 'This currency is not supported for top-ups.',
  wallet_closed: 'This wallet is closed.',
  provider_error: 'The payment provider is unavailable. Please try again in a moment.',
  topup_not_configured: 'Top-ups are not set up for this event yet.',
  invalid_return_url: 'We could not start the payment. Please try again.',
};

export const WALLET_HISTORY_LABELS: Record<string, string> = {
  TOPUP: 'Top-up',
  TRANSFER_OUT: 'Moved to your bracelet',
  TRANSFER_REVERSAL: 'Returned to your wallet',
  ADJUSTMENT: 'Adjustment',
};

export type TopUpState = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface WalletBaseline {
  balanceMinor: number;
  toppedUpMinor: number;
}

export function walletBaseline(wallet: Pick<WalletState, 'balance_minor' | 'topped_up_minor'> | null | undefined): WalletBaseline {
  return {
    balanceMinor: Number(wallet?.balance_minor) || 0,
    toppedUpMinor: Number(wallet?.topped_up_minor) || 0,
  };
}

export function resolveTopUpState(baseline: WalletBaseline, latest: WalletState): TopUpState {
  const latestBalance = Number(latest.balance_minor) || 0;
  const latestToppedUp = Number(latest.topped_up_minor) || 0;
  const latestPending = Number(latest.pending_amount_minor) || 0;
  if (latestBalance > baseline.balanceMinor || latestToppedUp > baseline.toppedUpMinor) return 'confirmed';
  if (latestPending > 0) return 'pending';
  return 'failed';
}

export function parseTopUpAmountMinor(preset: number | null, custom: string): number {
  if (preset) return preset * 100;
  const normalized = custom.replace(',', '.').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function formatMinor(minor: number | null | undefined, currency: string): string {
  const value = (Number(minor) || 0) / 100;
  return `${formatMoney(value)} ${currency}`;
}

export type AccountTicketTone = 'refunded' | 'entered' | 'ready' | 'todo' | 'valid';

export interface AccountTicketStatus {
  tone: AccountTicketTone;
  label: string;
}

export function ticketNeedsCheckIn(ticket: AccountTicket): boolean {
  if (isRefundedOrder(ticket.order?.payment_status)) return false;
  if (!ticket.event?.checkin_required) return false;
  if (ticket.entered) return false;
  return !isCheckInConfirmed(ticket.checkin?.status);
}

export function resolveAccountTicketStatus(ticket: AccountTicket): AccountTicketStatus {
  if (isRefundedOrder(ticket.order?.payment_status)) return { tone: 'refunded', label: 'Refunded' };
  if (ticket.entered) return { tone: 'entered', label: 'Entered' };
  if (isCheckInConfirmed(ticket.checkin?.status)) return { tone: 'ready', label: 'Ready for entrance' };
  if (ticket.event?.checkin_required) return { tone: 'todo', label: 'Check-in needed' };
  return { tone: 'valid', label: 'Valid ticket' };
}

export interface AccountTicketGroup {
  key: number;
  event: AccountTicket['event'];
  tickets: AccountTicket[];
}

export function groupTicketsByEvent(tickets: AccountTicket[]): AccountTicketGroup[] {
  const byEvent = new Map<number, AccountTicketGroup>();
  tickets.forEach((ticket) => {
    const key = ticket.event.id;
    const group = byEvent.get(key);
    if (group) group.tickets.push(ticket);
    else byEvent.set(key, { key, event: ticket.event, tickets: [ticket] });
  });
  return Array.from(byEvent.values());
}

export function walletTickets(tickets: AccountTicket[]): AccountTicket[] {
  return tickets.filter((ticket) => ticket.event?.wallet_topup_enabled && !isRefundedOrder(ticket.order?.payment_status));
}

export function walletTotalsByCurrency(tickets: AccountTicket[], fallbackCurrency = 'MDL'): { currency: string; minor: number }[] {
  const byCurrency = new Map<string, number>();
  tickets.forEach((ticket) => {
    const currency = ticket.wallet?.currency || fallbackCurrency;
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + (Number(ticket.wallet?.balance_minor) || 0));
  });
  return Array.from(byCurrency.entries()).map(([currency, minor]) => ({ currency, minor }));
}
