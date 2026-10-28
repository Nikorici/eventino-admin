import { buildSeatedOrderBody } from './orderBody';
import { holdPayload, holdSeat, unpricedHoldSeat } from './testFixtures';

describe('buildSeatedOrderBody', () => {
  it('builds one line per ticket type carrying the seat ids and hold token', () => {
    const hold = holdPayload({
      seats: [holdSeat(101, 7, '900.00'), holdSeat(201, 8, '500.00'), holdSeat(103, 9, '1500.00'), holdSeat(104, 7, '900.00')],
    });
    const body = buildSeatedOrderBody(hold, { coupon: 'PROMO', native_return: true, invoice_after_payment: false });
    expect(body).toEqual({
      coupon: 'PROMO',
      native_return: true,
      invoice_after_payment: false,
      seat_hold_token: 'hold-token-1',
      tickets: [
        { ticket_type_id: 7, quantity: 2, seat_ids: [101, 104] },
        { ticket_type_id: 8, quantity: 1, seat_ids: [201] },
        { ticket_type_id: 9, quantity: 1, seat_ids: [103] },
      ],
    });
  });

  it('leaves out seats whose category was removed', () => {
    const hold = holdPayload({ seats: [holdSeat(101, 7, '900.00'), unpricedHoldSeat(105)] });
    expect(buildSeatedOrderBody(hold).tickets).toEqual([{ ticket_type_id: 7, quantity: 1, seat_ids: [101] }]);
  });

  it('works without extras', () => {
    expect(buildSeatedOrderBody(holdPayload())).toEqual({
      seat_hold_token: 'hold-token-1',
      tickets: [{ ticket_type_id: 7, quantity: 1, seat_ids: [101] }],
    });
  });
});
