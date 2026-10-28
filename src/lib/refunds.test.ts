import { formatRefundAmount, hasScannedTicket, isRefundedOrder, refundErrorLabel, resolveRefundView } from './refunds';
import type { RefundEligibility } from '@/types/api';

function eligibility(overrides: Partial<RefundEligibility> = {}): RefundEligibility {
  return {
    order_id: 12,
    eligible: true,
    reason: 'eligible',
    amount: '150.00',
    currency: 'RON',
    payment_status: 'PAID',
    tickets: [{ id: 1, ticket_type: 'General', price: '150.00', event_title: 'Concert' }],
    refund_request: null,
    ...overrides,
  };
}

describe('resolveRefundView', () => {
  it('hides the panel without eligibility data', () => {
    expect(resolveRefundView(null)).toEqual({ kind: 'hidden' });
  });

  it('offers the refund with the formatted amount', () => {
    expect(resolveRefundView(eligibility())).toEqual({ kind: 'available', amount: '150 RON' });
  });

  it('shows the refunded state once the order is refunded', () => {
    const view = resolveRefundView(
      eligibility({ payment_status: 'REFUNDED', refund_request: { status: 'REFUNDED', amount: '150.00', currency: 'RON' } }),
    );
    expect(view).toEqual({ kind: 'refunded', amount: '150 RON' });
  });

  it('shows processing while the provider works', () => {
    expect(resolveRefundView(eligibility({ refund_request: { status: 'PROCESSING', amount: '150.00', currency: 'RON' } }))).toEqual({
      kind: 'processing',
    });
  });

  it('hides the panel whenever the order is not eligible', () => {
    expect(resolveRefundView(eligibility({ eligible: false, reason: 'order_not_paid' }))).toEqual({ kind: 'hidden' });
    expect(resolveRefundView(eligibility({ eligible: false, reason: 'self_service_refunds_disabled' }))).toEqual({ kind: 'hidden' });
  });

  it('hides the offer once a ticket was scanned but keeps a finished refund visible', () => {
    expect(resolveRefundView(eligibility(), true)).toEqual({ kind: 'hidden' });
    expect(resolveRefundView(eligibility({ refund_request: { status: 'FAILED', amount: '150.00', currency: 'RON' } }), true)).toEqual({ kind: 'hidden' });
    expect(resolveRefundView(eligibility({ refund_request: { status: 'PROCESSING', amount: '150.00', currency: 'RON' } }), true)).toEqual({ kind: 'processing' });
    expect(
      resolveRefundView(eligibility({ payment_status: 'REFUNDED', refund_request: { status: 'REFUNDED', amount: '150.00', currency: 'RON' } }), true),
    ).toEqual({ kind: 'refunded', amount: '150 RON' });
  });

  it('detects a scanned ticket in the order', () => {
    expect(hasScannedTicket([{ scan_date: null }, { scan_date: '2026-11-03T18:00:00Z' }])).toBe(true);
    expect(hasScannedTicket([{ scan_date: null }, {}])).toBe(false);
  });

  it('lets a failed attempt be retried', () => {
    expect(resolveRefundView(eligibility({ refund_request: { status: 'FAILED', amount: '150.00', currency: 'RON' } }))).toEqual({
      kind: 'failed',
      amount: '150 RON',
    });
  });
});

describe('refund helpers', () => {
  it('maps error codes to labels with a fallback', () => {
    expect(refundErrorLabel('already_refunded')).toBe('This order has already been refunded.');
    expect(refundErrorLabel('something_else')).toBe('The refund could not be processed. Please try again.');
  });

  it('detects refunded payment statuses case-insensitively', () => {
    expect(isRefundedOrder('refunded')).toBe(true);
    expect(isRefundedOrder('PAID')).toBe(false);
  });

  it('formats amounts with the currency and keeps cents when present', () => {
    expect(formatRefundAmount('12.50', 'MDL')).toBe('12.50 MDL');
    expect(formatRefundAmount('abc', 'MDL')).toBe('');
  });
});
