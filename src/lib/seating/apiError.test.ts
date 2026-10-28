import { parseSeatingError } from './apiError';

describe('parseSeatingError', () => {
  it('reads the seating error envelope', () => {
    expect(
      parseSeatingError({ status: 409, data: { detail: 'Seats taken', code: 'seats_unavailable', unavailable_seat_ids: [1, 2] } }),
    ).toEqual({ status: 409, code: 'seats_unavailable', message: 'Seats taken', unavailableSeatIds: [1, 2] });
  });

  it('reads the order error envelope', () => {
    expect(parseSeatingError({ status: 400, data: { message: 'Hold required', code: 'seat_hold_required' } })).toEqual({
      status: 400,
      code: 'seat_hold_required',
      message: 'Hold required',
      unavailableSeatIds: [],
    });
  });

  it('reads validate failures', () => {
    expect(parseSeatingError({ status: 409, data: { valid: false, code: 'hold_expired', unavailable_seat_ids: [] } })).toEqual({
      status: 409,
      code: 'hold_expired',
      message: null,
      unavailableSeatIds: [],
    });
  });

  it('tolerates transport errors and garbage', () => {
    expect(parseSeatingError({ status: 'FETCH_ERROR', error: 'boom' })).toEqual({
      status: null,
      code: null,
      message: null,
      unavailableSeatIds: [],
    });
    expect(parseSeatingError(null)).toEqual({ status: null, code: null, message: null, unavailableSeatIds: [] });
    expect(parseSeatingError({ status: 500, data: 'Server error' })).toEqual({
      status: 500,
      code: null,
      message: null,
      unavailableSeatIds: [],
    });
  });
});
