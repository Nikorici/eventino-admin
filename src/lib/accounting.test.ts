import { commissionLabel, formatAccountingAmount, moneyFromAccounting, remainingDisplay, settlementFromAccounting } from './accounting';
import type { EventAccounting } from '@/store/api/accountingApi';

function accounting(overrides: Partial<EventAccounting> = {}): EventAccounting {
  return {
    id: 1,
    event: 5,
    event_title: 'Fest',
    event_currency: 'MDL',
    event_country: 'Moldova',
    event_start_date: '2026-10-01',
    event_end_date: '2026-10-02',
    owner_name: 'Org',
    has_vat: false,
    vat_percent: 0,
    has_tax: false,
    tax_percent: 0,
    gross_total: '1000.00',
    vat_amount: '0',
    tax_amount: '0',
    platform_fee: '0',
    net_to_organizer: '950.00',
    currency: 'MDL',
    payment_status: 'PENDING',
    case_closed: false,
    notes: '',
    recipient_name: '',
    recipient_iban: '',
    recipient_company: null,
    company: null,
    transfers: [],
    paid_total: '0',
    remaining_amount: '950.00',
    tickets_income: '1000.00',
    tickets_sold: 10,
    total_received: '1000.00',
    commission_paid_by: 'ORGANIZER',
    commission_percent: '5',
    commission_amount: '50.00',
    buyer_fee_percent: '0',
    buyer_fee_vat_percent: '0',
    buyer_fee_net: '0',
    buyer_fee_vat: '0',
    buyer_fee_total: '0',
    tickets_total: '1000.00',
    collected_total: '1000.00',
    eventino_income: '50.00',
    settlement_currency: null,
    settlement_gross: '0',
    settlement_base: '0',
    settlement_commission: '0',
    settlement_net: '0',
    settlement_paid: '0',
    settlement_remaining: '0',
    settlement_fx_rate: '0',
    settlement_orders_count: 0,
    unsettled_total: '0',
    unsettled_currency: null,
    unsettled_orders_count: 0,
    ...overrides,
  };
}

describe('accounting helpers', () => {
  it('formats amounts and remaining balances', () => {
    expect(formatAccountingAmount('12.5', 'RON')).toBe('12.50 RON');
    expect(remainingDisplay(-20, 'RON', 'Overpaid by')).toEqual({ tone: 'danger', text: 'Overpaid by 20 RON' });
    expect(remainingDisplay(20, 'RON', 'Overpaid by')).toEqual({ tone: 'warning', text: '20 RON' });
  });

  it('only builds settlement figures when a settlement currency exists', () => {
    expect(settlementFromAccounting(accounting())).toBeNull();
    const figures = settlementFromAccounting(accounting({ settlement_currency: 'RON', settlement_gross: '4200', settlement_net: '4000', unsettled_currency: null }));
    expect(figures).toMatchObject({ currency: 'RON', gross: 4200, net: 4000, unsettledCurrency: 'MDL' });
  });

  it('derives the money split and commission label', () => {
    const money = moneyFromAccounting(accounting());
    expect(money).toMatchObject({ tickets: 1000, collected: 1000, eventino: 50, organizer: 950, commission: 50 });
    expect(commissionLabel(accounting(), { buyer: 'Buyer', organizer: 'Organizer', prefix: 'Commission paid by' })).toBe(
      'Commission paid by: Organizer (5%)',
    );
    expect(commissionLabel(accounting({ commission_paid_by: null }), { buyer: 'B', organizer: 'O', prefix: 'P' })).toBeNull();
  });
});
