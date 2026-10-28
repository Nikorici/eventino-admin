import { formatMoney } from '@/lib/pricing';
import type { RefundEligibility } from '@/types/api';

export const REFUND_FALLBACK_ERROR = 'The refund could not be processed. Please try again.';

export const REFUND_ERROR_LABELS: Record<string, string> = {
  self_service_refunds_disabled: 'Refund requests are not available for this event.',
  order_not_paid: 'Only paid orders can be refunded.',
  unsupported_payment_method: 'This order cannot be refunded online. Please contact the organizer.',
  nothing_to_refund: 'There is no refundable amount on this order.',
  already_refunded: 'This order has already been refunded.',
  refund_in_progress: 'This order already has a refund request.',
  refund_failed: REFUND_FALLBACK_ERROR,
};

export type RefundView =
  | { kind: 'refunded'; amount: string }
  | { kind: 'processing' }
  | { kind: 'failed'; amount: string }
  | { kind: 'available'; amount: string }
  | { kind: 'hidden' };

export function isRefundedOrder(paymentStatus?: string | null): boolean {
  return (paymentStatus ?? '').toUpperCase() === 'REFUNDED';
}

export function formatRefundAmount(amount: string | number | null | undefined, currency?: string | null): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  const formatted = formatMoney(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function refundErrorLabel(code?: string | null): string {
  return (code && REFUND_ERROR_LABELS[code]) || REFUND_FALLBACK_ERROR;
}

export function hasScannedTicket(tickets: { scan_date?: string | null }[]): boolean {
  return tickets.some((ticket) => Boolean(ticket.scan_date));
}

export function resolveRefundView(info: RefundEligibility | null | undefined, scanned = false): RefundView {
  if (!info) return { kind: 'hidden' };
  const refund = info.refund_request;
  const amount = formatRefundAmount(info.amount, info.currency);

  if (refund?.status === 'REFUNDED' || isRefundedOrder(info.payment_status)) {
    return { kind: 'refunded', amount: refund ? formatRefundAmount(refund.amount, refund.currency) : amount };
  }
  if (refund?.status === 'PROCESSING') return { kind: 'processing' };
  if (!info.eligible || scanned) return { kind: 'hidden' };
  if (refund?.status === 'FAILED') return { kind: 'failed', amount };
  return { kind: 'available', amount };
}
