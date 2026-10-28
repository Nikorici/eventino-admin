import { remainingTicketAllowance, seatSelectionLimit } from './allowance';

describe('remainingTicketAllowance', () => {
  it('is unlimited when the event has no per-user cap', () => {
    expect(remainingTicketAllowance({ eventId: 1, maxTicketsPerUser: undefined, hasBought: false })).toBeNull();
    expect(remainingTicketAllowance({ eventId: 1, maxTicketsPerUser: 0, hasBought: true })).toBeNull();
  });

  it('returns the per-user cap when set', () => {
    expect(remainingTicketAllowance({ eventId: 1, maxTicketsPerUser: 4, hasBought: true })).toBe(4);
  });

  it('treats hardcoded single ticket events as a cap of one', () => {
    expect(remainingTicketAllowance({ eventId: 1026, maxTicketsPerUser: undefined, hasBought: false })).toBe(1);
    expect(remainingTicketAllowance({ eventId: 1026, maxTicketsPerUser: undefined, hasBought: true })).toBe(0);
    expect(remainingTicketAllowance({ eventId: 1, maxTicketsPerUser: 1, hasBought: true })).toBe(0);
  });
});

describe('seatSelectionLimit', () => {
  it('caps the seat map limit by the remaining allowance', () => {
    expect(seatSelectionLimit(10, { eventId: 1, maxTicketsPerUser: undefined, hasBought: false })).toBe(10);
    expect(seatSelectionLimit(10, { eventId: 1, maxTicketsPerUser: 4, hasBought: false })).toBe(4);
    expect(seatSelectionLimit(2, { eventId: 1, maxTicketsPerUser: 4, hasBought: false })).toBe(2);
    expect(seatSelectionLimit(10, { eventId: 1026, maxTicketsPerUser: undefined, hasBought: true })).toBe(0);
  });
});
