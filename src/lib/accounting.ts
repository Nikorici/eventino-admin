import { formatMoney } from '@/lib/pricing';
import type { EventAccounting } from '@/store/api/accountingApi';

export function formatAccountingAmount(amount: string | number | null | undefined, currency?: string | null): string {
  const value = Number(amount ?? 0) || 0;
  return `${formatMoney(value)} ${currency ?? ''}`.trim();
}

export interface SettlementFigures {
  currency: string;
  gross: number;
  base: number;
  commission: number;
  net: number;
  paid: number;
  remaining: number;
  rate: number;
  ordersCount: number;
  unsettledTotal: number;
  unsettledCurrency: string;
  unsettledOrdersCount: number;
}

export function settlementFromAccounting(data: EventAccounting | null | undefined): SettlementFigures | null {
  if (!data || !data.settlement_currency) return null;
  const currency = data.currency || data.event_currency || '';
  return {
    currency: data.settlement_currency,
    gross: Number(data.settlement_gross) || 0,
    base: Number(data.settlement_base) || 0,
    commission: Number(data.settlement_commission) || 0,
    net: Number(data.settlement_net) || 0,
    paid: Number(data.settlement_paid) || 0,
    remaining: Number(data.settlement_remaining) || 0,
    rate: Number(data.settlement_fx_rate) || 0,
    ordersCount: Number(data.settlement_orders_count) || 0,
    unsettledTotal: Number(data.unsettled_total) || 0,
    unsettledCurrency: data.unsettled_currency || currency,
    unsettledOrdersCount: Number(data.unsettled_orders_count) || 0,
  };
}

export interface MoneyFigures {
  tickets: number;
  fee: number;
  feeVat: number;
  feeNet: number;
  feePercent: number;
  feeVatPercent: number;
  commission: number;
  collected: number;
  eventino: number;
  organizer: number;
}

export function moneyFromAccounting(data: EventAccounting | null | undefined): MoneyFigures | null {
  if (!data) return null;
  const tickets = Number(data.tickets_total ?? data.gross_total ?? 0) || 0;
  const fee = Number(data.buyer_fee_total) || 0;
  const commission = Number(data.commission_amount) || 0;
  return {
    tickets,
    fee,
    feeVat: Number(data.buyer_fee_vat) || 0,
    feeNet: Number(data.buyer_fee_net) || 0,
    feePercent: Number(data.buyer_fee_percent) || 0,
    feeVatPercent: Number(data.buyer_fee_vat_percent) || 0,
    commission,
    collected: data.collected_total != null ? Number(data.collected_total) || 0 : tickets + fee,
    eventino: data.eventino_income != null ? Number(data.eventino_income) || 0 : fee + commission,
    organizer: Number(data.net_to_organizer) || 0,
  };
}

export type RemainingTone = 'warning' | 'danger';

export function remainingDisplay(remaining: number, currency: string, overpaidLabel: string): { tone: RemainingTone; text: string } {
  if (remaining < 0) return { tone: 'danger', text: `${overpaidLabel} ${formatAccountingAmount(Math.abs(remaining), currency)}` };
  return { tone: 'warning', text: formatAccountingAmount(remaining, currency) };
}

export function commissionLabel(data: EventAccounting | null | undefined, labels: { buyer: string; organizer: string; prefix: string }): string | null {
  if (!data?.commission_paid_by) return null;
  const payerMap: Record<string, string> = { BUYER: labels.buyer, ORGANIZER: labels.organizer };
  const payer = payerMap[data.commission_paid_by] ?? data.commission_paid_by;
  const percent = Number(data.commission_percent) || 0;
  return `${labels.prefix}: ${payer}${percent ? ` (${percent}%)` : ''}`;
}
