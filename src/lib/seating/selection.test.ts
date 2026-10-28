import { buildSeatIndexFromResponse } from './seatIndex';
import { categoriesById, groupIntoLines, isPricedSeat, isSeatSelected, selectionReducer, toHoldSeat } from './selection';
import { fixtureSeatMap, holdSeat, unpricedHoldSeat } from './testFixtures';

describe('selectionReducer', () => {
  const seatA = holdSeat(101, 7, '900.00');
  const seatB = holdSeat(102, 7, '900.00');
  const seatC = holdSeat(201, 8, '500.00');

  it('toggles seats on and off', () => {
    const added = selectionReducer([], { type: 'toggle', seat: seatA, max: 10 });
    expect(added).toEqual([seatA]);
    expect(isSeatSelected(added, 101)).toBe(true);
    const removed = selectionReducer(added, { type: 'toggle', seat: seatA, max: 10 });
    expect(removed).toEqual([]);
  });

  it('refuses to exceed the maximum and returns the same reference', () => {
    const state = [seatA];
    expect(selectionReducer(state, { type: 'toggle', seat: seatB, max: 1 })).toBe(state);
    expect(selectionReducer(state, { type: 'toggle', seat: seatA, max: 1 })).toEqual([]);
  });

  it('removes seats by id and ignores unknown ids', () => {
    const state = [seatA, seatB, seatC];
    expect(selectionReducer(state, { type: 'remove', seatId: 102 })).toEqual([seatA, seatC]);
    expect(selectionReducer(state, { type: 'remove', seatId: 999 })).toBe(state);
    expect(selectionReducer(state, { type: 'removeMany', seatIds: [101, 201] })).toEqual([seatB]);
    expect(selectionReducer(state, { type: 'removeMany', seatIds: [999] })).toBe(state);
  });

  it('replaces from a hold and clears', () => {
    expect(selectionReducer([seatA], { type: 'replaceFromHold', seats: [seatB, seatC] })).toEqual([seatB, seatC]);
    const empty: typeof seatA[] = [];
    expect(selectionReducer(empty, { type: 'clear' })).toBe(empty);
    expect(selectionReducer([seatA], { type: 'clear' })).toEqual([]);
  });
});

describe('groupIntoLines', () => {
  it('groups by ticket type in first-appearance order', () => {
    const lines = groupIntoLines([holdSeat(101, 7, '900.00'), holdSeat(201, 8, '500.00'), holdSeat(103, 7, '900.00')]);
    expect(lines.map((line) => line.ticket_type_id)).toEqual([7, 8]);
    expect(lines[0]).toMatchObject({ name: 'Parter', price: '900.00', seat_ids: [101, 103] });
    expect(lines[1]).toMatchObject({ name: 'Balcon', price: '500.00', seat_ids: [201] });
    expect(lines[0].seats).toHaveLength(2);
  });

  it('returns no lines for an empty selection', () => {
    expect(groupIntoLines([])).toEqual([]);
  });

  it('leaves out seats whose category was removed', () => {
    const lines = groupIntoLines([holdSeat(101, 7, '900.00'), unpricedHoldSeat(105), holdSeat(201, 8, '500.00')]);
    expect(lines.map((line) => line.seat_ids)).toEqual([[101], [201]]);
  });
});

describe('isPricedSeat', () => {
  it('requires a ticket type, a name and a price', () => {
    expect(isPricedSeat(holdSeat(101, 7, '900.00'))).toBe(true);
    expect(isPricedSeat(unpricedHoldSeat(105))).toBe(false);
    expect(isPricedSeat(unpricedHoldSeat(105, { ticket_type_id: 7 }))).toBe(false);
  });
});

describe('toHoldSeat', () => {
  const index = buildSeatIndexFromResponse(fixtureSeatMap);
  const categories = categoriesById(fixtureSeatMap.categories);

  it('builds a hold seat from the index and category', () => {
    const seat = index.seatsById.get(103);
    expect(seat && toHoldSeat(seat, categories)).toEqual({
      seat_id: 103,
      section_id: 1,
      section_key: 'parter',
      section_name: 'Parter',
      row_label: '1',
      seat_label: '3',
      ticket_type_id: 9,
      ticket_type_name: 'VIP',
      price: '1500.00',
    });
  });

  it('returns null for seats without a sellable category', () => {
    const seat = index.seatsById.get(301);
    expect(seat && toHoldSeat(seat, categories)).toBeNull();
  });
});
