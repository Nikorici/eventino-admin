const EVENT_VAT_PERCENT_OVERRIDES: Record<number, number> = { 1360: 11, 1378: 21, 1383: 21 };
const EVENT_VAT_INCLUDED_OVERRIDES: Record<number, boolean> = { 1378: true, 1383: true, 1640: true };
const PLATFORM_FEE_OVERRIDES: Record<number, number> = { 1416: 7, 1426: 5 };

export interface PricingEvent {
  id: number;
  country?: string;
  platform_fee_percent?: number;
  commission_vat_percent?: number;
  commission_paid_by?: string;
  owner?: { tva_percent?: number; tva_included_in_ticket_price?: boolean };
}

export interface CartItem {
  ticketTypeId: number;
  price: number;
  quantity: number;
}

export interface AppliedCoupon {
  discount: number;
  ticket_types: number[];
}

export interface TotalBreakdown {
  subtotal: number;
  discountAmount: number;
  discountedSubtotal: number;
  vatPercent: number;
  vatIncluded: boolean;
  vatAmount: number;
  ticketsTotalWithVat: number;
  ticketsTotalWithoutVat: number;
  adminFee: number;
  feeRate: number;
  total: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveVat(event: PricingEvent): { vatPercent: number; vatIncluded: boolean } {
  const vatPercent = EVENT_VAT_PERCENT_OVERRIDES[event.id] ?? event.owner?.tva_percent ?? 0;
  const vatIncluded = EVENT_VAT_INCLUDED_OVERRIDES[event.id] ?? event.owner?.tva_included_in_ticket_price ?? true;
  return { vatPercent, vatIncluded };
}

function resolvePlatformPercent(event: PricingEvent): number {
  let percent = clamp(event.platform_fee_percent ?? 0, 0, 100);
  if (PLATFORM_FEE_OVERRIDES[event.id] != null) percent = PLATFORM_FEE_OVERRIDES[event.id];
  return percent;
}

export function calculatePlatformFee(base: number, percent: number, event: PricingEvent): number {
  const feeMinorUnits = Math.trunc(base * percent);
  return Math.round(feeMinorUnits * (1 + (event.commission_vat_percent ?? 0) / 100)) / 100;
}

export function calcTotal(items: CartItem[], event: PricingEvent, coupon?: AppliedCoupon | null): TotalBreakdown {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const couponTicketTypes = coupon?.ticket_types ?? [];
  const discountableSubtotal = coupon
    ? items
        .filter((item) => couponTicketTypes.length === 0 || couponTicketTypes.includes(item.ticketTypeId))
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
    : 0;
  const discountAmount = discountableSubtotal * ((coupon?.discount ?? 0) / 100);
  const discountedSubtotal = subtotal - discountAmount;

  const { vatPercent, vatIncluded } = resolveVat(event);
  const rate = vatPercent / 100;

  let ticketsTotalWithVat: number;
  let ticketsTotalWithoutVat: number;
  let vatAmount: number;

  if (vatIncluded) {
    ticketsTotalWithVat = discountedSubtotal;
    ticketsTotalWithoutVat = rate > 0 ? discountedSubtotal / (1 + rate) : discountedSubtotal;
    vatAmount = ticketsTotalWithVat - ticketsTotalWithoutVat;
  } else {
    ticketsTotalWithoutVat = discountedSubtotal;
    vatAmount = discountedSubtotal * rate;
    ticketsTotalWithVat = discountedSubtotal + vatAmount;
  }

  let adminFee = 0;
  let feeRate = 0;
  if (discountedSubtotal > 0) {
    feeRate = resolvePlatformPercent(event);
    adminFee = calculatePlatformFee(discountedSubtotal, feeRate, event);
  }

  const total = ticketsTotalWithVat + adminFee;

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    vatPercent,
    vatIncluded,
    vatAmount,
    ticketsTotalWithVat,
    ticketsTotalWithoutVat,
    adminFee,
    feeRate,
    total,
  };
}

export function formatMoney(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
