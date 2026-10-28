import {
  installmentsComplete,
  installmentsMatchTotal,
  isOfferClosed,
  offerPaymentsSummary,
  offerProgressPercent,
  offerScheduleRows,
  splitEqually,
} from './privateOffers';

describe('splitEqually', () => {
  it('splits cents evenly and puts the remainder on the last row', () => {
    expect(splitEqually('100.00', 3)).toEqual(['33.33', '33.33', '33.34']);
    expect(splitEqually(0, 3)).toEqual([]);
  });
});

describe('installment validation', () => {
  it('requires every row to have a date and a positive amount that sum to the total', () => {
    const rows = [
      { due_date: '2026-10-01', amount: '50' },
      { due_date: '2026-11-01', amount: '50' },
    ];
    expect(installmentsComplete(rows)).toBe(true);
    expect(installmentsMatchTotal(rows, '100')).toBe(true);
    expect(installmentsMatchTotal(rows, '120')).toBe(false);
    expect(installmentsComplete([{ due_date: '', amount: '50' }])).toBe(false);
  });
});

describe('offer summaries', () => {
  const plan = {
    order_id: 1,
    status: 'ACTIVE',
    total_amount: '100.00',
    paid_amount: '50.00',
    installments: [
      { sequence: 1, amount: '50.00', due_date: '2026-10-01', status: 'PAID' },
      { sequence: 2, amount: '50.00', due_date: '2026-11-01', status: 'PENDING' },
    ],
    next_due: { sequence: 2, amount: '50.00', due_date: '2026-11-01', status: 'PENDING' },
  };

  it('summarizes plans, scheduled installments and one-off offers', () => {
    expect(offerPaymentsSummary({ installment_plan: plan, installments: [] })).toEqual({ kind: 'plan', paid: 1, total: 2, next: plan.next_due });
    expect(offerPaymentsSummary({ installment_plan: null, installments: [{ due_date: '2026-10-01', amount: '10' }] })).toEqual({ kind: 'scheduled', count: 1 });
    expect(offerPaymentsSummary({ installment_plan: null, installments: [] })).toEqual({ kind: 'none' });
  });

  it('builds schedule rows from the plan or the offer and computes progress', () => {
    expect(offerScheduleRows({ installment_plan: plan, installments: [] })).toHaveLength(2);
    expect(offerScheduleRows({ installment_plan: null, installments: [{ due_date: '2026-10-01', amount: '10' }] })).toEqual([
      { sequence: 1, amount: '10', due_date: '2026-10-01', status: 'PENDING' },
    ]);
    expect(offerProgressPercent({ installment_plan: plan })).toBe(50);
    expect(offerProgressPercent({ installment_plan: null })).toBe(0);
    expect(isOfferClosed('CANCELLED')).toBe(true);
    expect(isOfferClosed('ACTIVE')).toBe(false);
  });
});
