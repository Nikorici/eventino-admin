import type { PrivateOffer, PublicPrivateOffer } from '@/store/api/privateOffersApi';

export interface InstallmentRowInput {
  due_date: string;
  amount: string;
}

export function emptyInstallmentRows(count = 3): InstallmentRowInput[] {
  return Array.from({ length: count }, () => ({ due_date: '', amount: '' }));
}

export function splitEqually(total: string | number, count: number): string[] {
  const cents = Math.round(Number(total) * 100);
  if (!cents || !count) return [];
  const base = Math.floor(cents / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[count - 1] += cents - base * count;
  return amounts.map((value) => (value / 100).toFixed(2));
}

export function installmentsSum(rows: InstallmentRowInput[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function installmentsMatchTotal(rows: InstallmentRowInput[], total: string | number): boolean {
  return Math.abs(installmentsSum(rows) - (Number(total) || 0)) < 0.005;
}

export function installmentsComplete(rows: InstallmentRowInput[]): boolean {
  return rows.every((row) => Boolean(row.due_date) && Number(row.amount) > 0);
}

export type OfferPaymentsSummary =
  | { kind: 'plan'; paid: number; total: number; next: { amount: string; due_date: string } | null }
  | { kind: 'scheduled'; count: number }
  | { kind: 'none' };

export function offerPaymentsSummary(offer: Pick<PrivateOffer, 'installment_plan' | 'installments'>): OfferPaymentsSummary {
  const plan = offer.installment_plan;
  if (plan) {
    const paid = plan.installments.filter((row) => row.status === 'PAID').length;
    return { kind: 'plan', paid, total: plan.installments.length, next: plan.next_due };
  }
  if (offer.installments && offer.installments.length > 0) return { kind: 'scheduled', count: offer.installments.length };
  return { kind: 'none' };
}

export interface ScheduleRow {
  sequence: number;
  amount: string;
  due_date: string;
  status: string;
}

export function offerScheduleRows(offer: Pick<PublicPrivateOffer, 'installment_plan' | 'installments'>): ScheduleRow[] {
  const plan = offer.installment_plan;
  if (plan) return plan.installments.map((row) => ({ sequence: row.sequence, amount: row.amount, due_date: row.due_date, status: row.status }));
  return (offer.installments ?? []).map((row, index) => ({ sequence: index + 1, amount: row.amount, due_date: row.due_date, status: 'PENDING' }));
}

export function offerProgressPercent(offer: Pick<PublicPrivateOffer, 'installment_plan'>): number {
  const plan = offer.installment_plan;
  if (!plan) return 0;
  const total = Number(plan.total_amount) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((Number(plan.paid_amount) / total) * 100));
}

export function isOfferClosed(status?: string | null): boolean {
  return status === 'CANCELLED' || status === 'EXPIRED';
}
