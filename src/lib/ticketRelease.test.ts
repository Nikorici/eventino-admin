import { buildReleasePayload, liveTicketTypes, releaseRowSeatError, validatePhone, zonesForTicketType } from './ticketRelease';
import type { ArenaVenue, ArenaZone } from '@/types/api';

const attendee = { firstName: 'Ana', lastName: 'Pop', email: 'ana@example.com' };

function zone(overrides: Partial<ArenaZone>): ArenaZone {
  return {
    id: 1,
    zone_id: 1,
    name: 'A',
    template_slot_id: 'a',
    color: '#000',
    capacity: 10,
    tickets_sold: 0,
    available_capacity: 10,
    is_full: false,
    is_active: true,
    comment: '',
    ticket_type_id: 7,
    ticket_type_name: 'VIP',
    ticket_price: '100',
    ...overrides,
  };
}

describe('validatePhone', () => {
  it('accepts international and local numbers', () => {
    expect(validatePhone('+40 721 000 000')).toBe(true);
    expect(validatePhone('(069) 12-34-56')).toBe(true);
  });

  it('rejects letters, misplaced plus signs and short numbers', () => {
    expect(validatePhone('abc')).toBe(false);
    expect(validatePhone('07+21')).toBe(false);
    expect(validatePhone('++40721')).toBe(false);
    expect(validatePhone('12345')).toBe(false);
  });
});

describe('buildReleasePayload', () => {
  it('adds the phone only when filled', () => {
    expect(buildReleasePayload({ ...attendee, phone: '  ' }, { ticketTypeId: 7, quantity: 2 }, false)).toEqual({
      ...attendee,
      ticketTypeId: 7,
      quantity: 2,
    });
    expect(buildReleasePayload({ ...attendee, phone: '+40721' }, { ticketTypeId: 7, quantity: 1 }, false).phone).toBe('+40721');
  });

  it('sends seat ids for seated events and the zone otherwise', () => {
    expect(buildReleasePayload(attendee, { ticketTypeId: 7, quantity: 2, zoneId: 3, seatIds: [11, 12] }, true)).toMatchObject({
      seat_ids: [11, 12],
    });
    expect(buildReleasePayload(attendee, { ticketTypeId: 7, quantity: 2, zoneId: 3, seatIds: [11, 12] }, true).zoneId).toBeUndefined();
    expect(buildReleasePayload(attendee, { ticketTypeId: 7, quantity: 1, zoneId: 3 }, false)).toMatchObject({ zoneId: 3 });
  });
});

describe('releaseRowSeatError', () => {
  it('requires exactly one seat per ticket on seated events', () => {
    expect(releaseRowSeatError({ ticketTypeId: 7, quantity: 2, seatIds: [1] }, true)).toEqual({ expected: 2, picked: 1 });
    expect(releaseRowSeatError({ ticketTypeId: 7, quantity: 2, seatIds: [1, 2] }, true)).toBeNull();
    expect(releaseRowSeatError({ ticketTypeId: 7, quantity: 2 }, false)).toBeNull();
  });
});

describe('liveTicketTypes', () => {
  const sales = [
    { id: 1, name: 'Bronze', price: 1999 },
    { id: 2, name: 'Bronze', price: 2599 },
    { id: 3, name: 'Guest', price: 0 },
    { id: 4, name: 'Old guest', price: 0 },
  ];

  it('keeps only the ticket types that are live on the event, free ones included', () => {
    const eventTicketTypes = [
      { id: 1, is_active: false },
      { id: 2, is_active: true },
      { id: 3, is_active: true },
      { id: 4, is_active: false },
    ];
    expect(liveTicketTypes(sales, eventTicketTypes).map((item) => item.id)).toEqual([2, 3]);
  });

  it('returns nothing until the event ticket types are loaded', () => {
    expect(liveTicketTypes(sales, undefined)).toEqual([]);
  });
});

describe('zonesForTicketType', () => {
  it('returns active zones assigned to the ticket type across venues', () => {
    const venues: ArenaVenue[] = [
      {
        id: 1,
        venue_id: 1,
        name: 'Arena',
        location: '',
        capacity: 100,
        template: 'standard_arena',
        configuration_notes: null,
        zones: [zone({ zone_id: 1 }), zone({ zone_id: 2, ticket_type_id: 8 }), zone({ zone_id: 3, is_active: false })],
      },
    ];
    expect(zonesForTicketType(venues, 7).map((item) => item.zone_id)).toEqual([1]);
    expect(zonesForTicketType(undefined, 7)).toEqual([]);
  });
});
