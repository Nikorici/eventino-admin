import { buildCreateEventBody, buildUpdateEventBody, type CreateEventInput, type UpdateEventInput } from './eventFormBody';

interface FormPart {
  fieldName: string;
  string?: string;
}

function hasParts(value: unknown): value is { getParts(): FormPart[] } {
  return typeof value === 'object' && value !== null && 'getParts' in value;
}

function hasEntries(value: unknown): value is { entries(): IterableIterator<[string, unknown]> } {
  return typeof value === 'object' && value !== null && 'entries' in value;
}

function fieldValues(form: unknown): Record<string, string | undefined> {
  if (hasParts(form)) {
    return Object.fromEntries(form.getParts().map((part) => [part.fieldName, part.string]));
  }
  if (hasEntries(form)) {
    return Object.fromEntries(
      Array.from(form.entries()).map(([name, value]) => [name, typeof value === 'string' ? value : undefined]),
    );
  }
  throw new Error('Unsupported FormData implementation');
}

const scalars = {
  title: 'Form Night',
  description: 'Desc',
  category: 1,
  type: 'PUBLIC' as const,
  currency: 'RON',
  in_draft: false,
  start_date: '2030-05-01',
  start_time: '20:00',
  event_location_type: 'physical' as const,
  location_is_tba: false,
  country: 'Romania',
  region: 'Cluj',
  address: 'Strada Test 1',
  ticket_types: [],
  questions: [],
  organizers: [],
  timelines: [],
};

const updateInput: UpdateEventInput = {
  ...scalars,
  id: 5,
  newPhotos: [],
  existingImageIds: [12],
  mediaOrder: [{ type: 'image', existing_image_id: 12 }],
  removeVideo: false,
};

const createInput: CreateEventInput = {
  ...scalars,
  owner: 1,
  coupons: [],
  photos: [],
};

describe('buildUpdateEventBody', () => {
  it('always sends timelines so clearing the last item persists', () => {
    const fields = fieldValues(buildUpdateEventBody(updateInput));
    expect(fields.timelines).toBe('[]');
    expect(fields.replace_images).toBe('true');
    expect(fields.existing_image_ids).toBe('[12]');
    expect(fields.media_order).toBe(JSON.stringify([{ type: 'image', existing_image_id: 12 }]));
    expect(fields.video).toBeUndefined();
  });

  it('sends an empty video field when the organizer removed the video', () => {
    const fields = fieldValues(buildUpdateEventBody({ ...updateInput, removeVideo: true }));
    expect(fields.video).toBe('');
  });
});

describe('buildCreateEventBody', () => {
  it('leaves timelines out when there are none', () => {
    const fields = fieldValues(buildCreateEventBody(createInput));
    expect(fields.timelines).toBeUndefined();
    expect(fields.owner).toBe('1');
  });

  it('sends the time to be announced flag', () => {
    expect(fieldValues(buildCreateEventBody(createInput)).time_is_tba).toBe('false');
    expect(fieldValues(buildCreateEventBody({ ...createInput, time_is_tba: true, start_time: '00:00' })).time_is_tba).toBe('true');
  });
});
