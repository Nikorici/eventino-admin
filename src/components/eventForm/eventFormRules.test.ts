import {
  defaultEventSchedule,
  describeEventSubmitError,
  detectMeetingPlatform,
  nextQuantityDiscountRow,
  requiredPaymentSetup,
  validateQuantityDiscountTiers,
} from './eventFormRules';

describe('validateQuantityDiscountTiers', () => {
  it('sorts valid tiers and drops empty rows', () => {
    expect(
      validateQuantityDiscountTiers([
        { min_quantity: '5', percent: '10' },
        { min_quantity: '', percent: '' },
        { min_quantity: '3', percent: '5' },
      ]),
    ).toEqual({ error: null, tiers: [{ min_quantity: 3, percent: 5 }, { min_quantity: 5, percent: 10 }] });
  });

  it('returns null tiers when nothing is filled', () => {
    expect(validateQuantityDiscountTiers([])).toEqual({ error: null, tiers: null });
  });

  it('rejects the same cases as the web', () => {
    expect(validateQuantityDiscountTiers([{ min_quantity: '1', percent: '10' }]).error).toBe('minQuantity');
    expect(validateQuantityDiscountTiers([{ min_quantity: '3', percent: '100' }]).error).toBe('percent');
    expect(validateQuantityDiscountTiers([{ min_quantity: '3', percent: '2.5' }]).error).toBe('percent');
    expect(
      validateQuantityDiscountTiers([
        { min_quantity: '3', percent: '5' },
        { min_quantity: '3', percent: '8' },
      ]).error,
    ).toBe('duplicate');
    expect(
      validateQuantityDiscountTiers(Array.from({ length: 11 }, (_, i) => ({ min_quantity: String(i + 2), percent: '5' }))).error,
    ).toBe('tooMany');
  });

  it('suggests the next tier two tickets above the last one', () => {
    expect(nextQuantityDiscountRow([])).toEqual({ min_quantity: '3', percent: '' });
    expect(nextQuantityDiscountRow([{ min_quantity: '5', percent: '10' }])).toEqual({ min_quantity: '7', percent: '' });
  });
});

describe('requiredPaymentSetup', () => {
  const paid = { hasPaidTickets: true, contractSigned: false, stripeConnected: false };

  it('asks for nothing on free events', () => {
    expect(requiredPaymentSetup({ ...paid, hasPaidTickets: false, country: 'Moldova', currency: 'MDL' })).toBeNull();
  });

  it('routes Moldova to MAIB, RON to NETOPIA and other currencies to Stripe', () => {
    expect(requiredPaymentSetup({ ...paid, country: 'Moldova', currency: 'EUR' })).toBe('maib');
    expect(requiredPaymentSetup({ ...paid, country: 'Romania', currency: 'RON' })).toBe('netopia');
    expect(requiredPaymentSetup({ ...paid, country: 'Romania', currency: 'EUR' })).toBe('stripe');
    expect(requiredPaymentSetup({ ...paid, country: 'Romania', currency: 'MDL' })).toBeNull();
  });

  it('skips the contract once signed and Stripe once connected', () => {
    expect(requiredPaymentSetup({ ...paid, contractSigned: true, country: 'Moldova', currency: 'MDL' })).toBeNull();
    expect(requiredPaymentSetup({ ...paid, contractSigned: true, country: 'Romania', currency: 'RON' })).toBeNull();
    expect(requiredPaymentSetup({ ...paid, stripeConnected: true, country: 'Romania', currency: 'EUR' })).toBeNull();
  });
});

describe('detectMeetingPlatform', () => {
  it('recognises Zoom and Google Meet links', () => {
    expect(detectMeetingPlatform('https://us02web.zoom.us/j/123456789')).toBe('zoom');
    expect(detectMeetingPlatform('https://meet.google.com/abc-defg-hij')).toBe('google_meet');
    expect(detectMeetingPlatform('https://teams.microsoft.com/l/meetup')).toBe('other');
  });
});

describe('defaultEventSchedule', () => {
  it('starts now and ends one hour later, rolling over midnight', () => {
    expect(defaultEventSchedule(new Date(2026, 9, 28, 23, 30))).toEqual({
      startDate: '2026-10-28',
      startTime: '23:30',
      endDate: '2026-10-29',
      endTime: '00:30',
    });
  });
});

describe('describeEventSubmitError', () => {
  const t = (key: string) => key;

  it('prefers the backend message', () => {
    expect(describeEventSubmitError({ status: 400, data: { title: ['This field is required.'] } }, t)).toBe('This field is required.');
  });

  it('maps HTML error pages and transport failures to the web texts', () => {
    expect(describeEventSubmitError({ status: 'PARSING_ERROR', originalStatus: 413, data: '<html>413</html>' }, t)).toBe(
      'Files too large. Please reduce image or video size and try again.',
    );
    expect(describeEventSubmitError({ status: 500, data: null }, t)).toBe('Server error (500). Please try again later.');
    expect(describeEventSubmitError({ status: 'FETCH_ERROR', error: 'TypeError' }, t)).toBe(
      'Network error. Check your internet connection and try again.',
    );
    expect(describeEventSubmitError(new Error('boom'), t)).toBeUndefined();
  });
});
