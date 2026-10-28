import {
  formatMinor,
  groupTicketsByEvent,
  isCheckInConfirmed,
  mapServerFieldErrors,
  parseTopUpAmountMinor,
  resolveAccountTicketStatus,
  resolveTopUpState,
  ticketNeedsCheckIn,
  validateCheckInFields,
  walletTickets,
  walletTotalsByCurrency,
} from './checkin';
import type { AccountTicket, WalletState } from '@/store/api/checkinApi';

const now = new Date(2026, 8, 23);

function wallet(overrides: Partial<WalletState> = {}): WalletState {
  return {
    currency: 'MDL',
    balance_minor: 0,
    pending_amount_minor: 0,
    topped_up_minor: 0,
    transferred_minor: 0,
    min_topup_minor: 1000,
    max_topup_minor: 500000,
    entries: [],
    ...overrides,
  };
}

function ticket(overrides: Partial<AccountTicket> = {}): AccountTicket {
  return {
    id: 1,
    uuid: 'u',
    ticket_type: 'General',
    display_name: null,
    entered: false,
    scan_date: null,
    order: { id: 9, payment_status: 'PAID', refund_request: null },
    event: {
      id: 5,
      title: 'Fest',
      start_date: '2026-10-01',
      currency: 'MDL',
      image: null,
      checkin_required: true,
      wallet_topup_enabled: true,
    },
    checkin: { status: 'NONE', full_name: '', has_selfie: false, selfie_url: null, editable: true },
    checkin_token: null,
    wallet: wallet(),
    bracelet: { linked: false, conpay_card_id: null, status: null },
    ...overrides,
  };
}

describe('validateCheckInFields', () => {
  it('requires a first and last name, a plausible birth date and a photo', () => {
    expect(validateCheckInFields({ fullName: 'Ana', dateOfBirth: '', hasSelfie: false, selfieRequired: true, now })).toEqual({
      full_name: 'Please enter your first and last name.',
      date_of_birth: 'Please enter your date of birth.',
      selfie: 'Please add a photo of yourself.',
    });
  });

  it('rejects future and implausible birth dates', () => {
    expect(validateCheckInFields({ fullName: 'Ana Pop', dateOfBirth: '2030-01-01', hasSelfie: true, selfieRequired: true, now }).date_of_birth).toBe(
      'Your date of birth cannot be in the future.',
    );
    expect(validateCheckInFields({ fullName: 'Ana Pop', dateOfBirth: '2025-01-01', hasSelfie: true, selfieRequired: true, now }).date_of_birth).toBe(
      'Please check your date of birth.',
    );
    expect(validateCheckInFields({ fullName: 'Ana Pop', dateOfBirth: '2026-02-30', hasSelfie: true, selfieRequired: true, now }).date_of_birth).toBe(
      'Please enter a valid date of birth.',
    );
  });

  it('accepts a complete submission and skips the photo when one is already stored', () => {
    expect(validateCheckInFields({ fullName: 'Ana Pop', dateOfBirth: '1990-06-15', hasSelfie: false, selfieRequired: false, now })).toEqual({});
  });
});

describe('mapServerFieldErrors', () => {
  it('flattens nested server messages for the known fields', () => {
    expect(mapServerFieldErrors({ full_name: ['Too short'], selfie: { file: ['Too big'] }, other: 'x' })).toEqual({
      full_name: 'Too short',
      selfie: 'Too big',
    });
    expect(mapServerFieldErrors('nope')).toEqual({});
  });
});

describe('top-up helpers', () => {
  it('confirms when the balance or topped-up total grew, stays pending otherwise', () => {
    const baseline = { balanceMinor: 1000, toppedUpMinor: 1000 };
    expect(resolveTopUpState(baseline, wallet({ balance_minor: 6000, topped_up_minor: 6000 }))).toBe('confirmed');
    expect(resolveTopUpState(baseline, wallet({ balance_minor: 1000, topped_up_minor: 1000, pending_amount_minor: 5000 }))).toBe('pending');
    expect(resolveTopUpState(baseline, wallet({ balance_minor: 1000, topped_up_minor: 1000 }))).toBe('failed');
  });

  it('parses preset and custom amounts into minor units', () => {
    expect(parseTopUpAmountMinor(50, '')).toBe(5000);
    expect(parseTopUpAmountMinor(null, '12,5')).toBe(1250);
    expect(parseTopUpAmountMinor(null, 'abc')).toBe(0);
    expect(parseTopUpAmountMinor(null, '-3')).toBe(0);
  });

  it('formats minor units with the currency', () => {
    expect(formatMinor(12550, 'MDL')).toBe('125.50 MDL');
    expect(formatMinor(undefined, 'MDL')).toBe('0 MDL');
  });
});

describe('account ticket helpers', () => {
  it('resolves the ticket status in priority order', () => {
    expect(resolveAccountTicketStatus(ticket({ order: { id: 9, payment_status: 'REFUNDED', refund_request: null } })).tone).toBe('refunded');
    expect(resolveAccountTicketStatus(ticket({ entered: true })).tone).toBe('entered');
    expect(resolveAccountTicketStatus(ticket({ checkin: { status: 'SUBMITTED', full_name: 'Ana Pop', has_selfie: true, selfie_url: null, editable: true } })).tone).toBe('ready');
    expect(resolveAccountTicketStatus(ticket()).tone).toBe('todo');
    expect(resolveAccountTicketStatus(ticket({ event: { ...ticket().event, checkin_required: false } })).tone).toBe('valid');
  });

  it('counts check-in as needed only for live, unconfirmed, required tickets', () => {
    expect(ticketNeedsCheckIn(ticket())).toBe(true);
    expect(ticketNeedsCheckIn(ticket({ entered: true }))).toBe(false);
    expect(ticketNeedsCheckIn(ticket({ order: { id: 9, payment_status: 'REFUNDED', refund_request: null } }))).toBe(false);
    expect(isCheckInConfirmed('approved')).toBe(true);
  });

  it('groups tickets by event and sums wallet balances per currency', () => {
    const tickets = [
      ticket({ id: 1, wallet: wallet({ balance_minor: 1000 }) }),
      ticket({ id: 2, wallet: wallet({ balance_minor: 500, currency: 'RON' }) }),
      ticket({ id: 3, event: { ...ticket().event, id: 6, wallet_topup_enabled: false } }),
      ticket({ id: 4, order: { id: 10, payment_status: 'REFUNDED', refund_request: null }, wallet: wallet({ balance_minor: 700 }) }),
    ];
    expect(groupTicketsByEvent(tickets).map((group) => [group.key, group.tickets.length])).toEqual([
      [5, 3],
      [6, 1],
    ]);
    const withWallet = walletTickets(tickets);
    expect(withWallet.map((item) => item.id)).toEqual([1, 2]);
    expect(walletTotalsByCurrency(withWallet)).toEqual([
      { currency: 'MDL', minor: 1000 },
      { currency: 'RON', minor: 500 },
    ]);
  });
});
