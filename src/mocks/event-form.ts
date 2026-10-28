import type { OrganizationResult } from '@/store/api/usersApi';
import type {
  Category,
  EventCoupon,
  EventDetail,
  EventQuestion,
  EventType,
  Organizer,
  QuantityDiscountTier,
  QuestionType,
  TicketType,
} from '@/types/api';

import { currentMockUser, findMockEvent, mockEvents, mockUsers, type MockEvent, type MockTicketType } from './core';
import { isoDate, isoDateTime, mock, mockError, paginate, type MockHandler, type MockRequest } from './mock';

const categories: Category[] = [
  { id: 1, name: 'Concerte' },
  { id: 2, name: 'Festivaluri' },
  { id: 3, name: 'Conferințe' },
  { id: 4, name: 'Stand-up' },
  { id: 5, name: 'Teatru' },
  { id: 6, name: 'Petreceri' },
  { id: 7, name: 'Sport' },
  { id: 8, name: 'Workshop-uri' },
  { id: 9, name: 'Expoziții' },
  { id: 10, name: 'Film' },
  { id: 11, name: 'Gastronomie' },
  { id: 12, name: 'Copii și familie' },
];

const organizations: OrganizationResult[] = [
  ...mockUsers.map((user) => ({
    id: user.id,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    organization_name: user.organization_name ?? null,
    is_organization: user.is_organization ?? false,
    profile_image: user.profile_image ?? null,
  })),
  {
    id: 2001,
    first_name: 'Teatrul',
    last_name: 'Satiricus',
    organization_name: 'Teatrul Satiricus „Ion Luca Caragiale”',
    is_organization: true,
    profile_image: null,
  },
  {
    id: 2002,
    first_name: 'Moldova',
    last_name: 'Concert',
    organization_name: 'Moldova Concert',
    is_organization: true,
    profile_image: null,
  },
  {
    id: 2003,
    first_name: 'Andreea',
    last_name: 'Munteanu',
    organization_name: null,
    is_organization: false,
    profile_image: null,
  },
  {
    id: 2004,
    first_name: 'Iași',
    last_name: 'Comedy',
    organization_name: 'Iași Comedy Club',
    is_organization: true,
    profile_image: null,
  },
  {
    id: 2005,
    first_name: 'Fundația',
    last_name: 'Culturală',
    organization_name: 'Fundația Culturală Timișoara',
    is_organization: true,
    profile_image: null,
  },
  {
    id: 2006,
    first_name: 'Victor',
    last_name: 'Rusu',
    organization_name: null,
    is_organization: false,
    profile_image: null,
  },
];

type StoredQuestion = EventQuestion & {
  description: string;
  conditions: unknown[];
};

const QUESTION_TYPES: QuestionType[] = [
  'short_answer',
  'paragraph',
  'email',
  'phone_number',
  'multiple_choice',
  'checkboxes',
  'dropdown',
];

const WINE_GALLERY = [
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80',
  'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=1200&q=80',
  'https://images.unsplash.com/photo-1528823872057-9c018a7a7553?w=1200&q=80',
];
const PLACEHOLDER_PHOTO = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

function organizerOf(id: number): Organizer | null {
  const found = organizations.find((organization) => organization.id === id);
  return found
    ? {
        id: found.id,
        first_name: found.first_name,
        last_name: found.last_name,
        organization_name: found.organization_name,
        profile_image: found.profile_image,
      }
    : null;
}

function patchTicket(event: MockEvent, id: number, extra: Partial<TicketType>): void {
  const ticket = event.ticketTypes.find((candidate) => candidate.id === id);
  if (ticket) ticket.extra = { ...ticket.extra, ...extra };
}

function enrich(id: number, detail: Partial<EventDetail>): MockEvent | undefined {
  const event = findMockEvent(id);
  if (event) event.detail = { ...event.detail, coupons: [], ...detail };
  return event;
}

const wineFestival = enrich(4101, {
  categories: [categories[1]],
  event_images: WINE_GALLERY.map((image, order) => ({
    id: 4101 + order * 1000,
    image,
    order,
  })),
  images: WINE_GALLERY,
  coordinates: { lat: 47.0245, long: 28.8323 },
  organizers: [organizerOf(1002)].filter((organizer): organizer is Organizer => organizer !== null),
  coupons: [
    {
      id: 901,
      code: 'TOAMNA20',
      discount: 20,
      max_uses: 100,
      usage_count: 37,
      is_active: true,
    },
    {
      id: 902,
      code: 'VINARII10',
      discount: 10,
      max_uses: 0,
      usage_count: 212,
      is_active: true,
    },
    {
      id: 903,
      code: 'EARLY15',
      discount: 15,
      max_uses: 50,
      usage_count: 50,
      is_active: false,
    },
  ],
});
if (wineFestival) {
  const questions: StoredQuestion[] = [
    {
      id: 701,
      question: 'Cum ai aflat de festival?',
      description: '',
      type: 'multiple_choice',
      options: ['Facebook', 'Instagram', 'De la prieteni', 'Altă sursă'],
      required: true,
      conditions: [
        {
          optionIndex: 3,
          action: 'show_message',
          message: 'Mulțumim! Spune-ne la intrare de unde ai aflat.',
          targetQuestionIndex: null,
          targetQuestionId: null,
        },
      ],
    },
    {
      id: 702,
      question: 'Număr de telefon',
      description: 'Pentru notificări despre program',
      type: 'phone_number',
      options: [],
      required: false,
      conditions: [],
    },
  ];
  const extras = {
    questions_data: questions,
    timelines: [
      {
        id: 'deschidere',
        title: 'Deschiderea oficială',
        description: 'Cuvânt de salut și tăierea panglicii',
        start_time: '12:00',
        end_time: '12:30',
      },
      {
        id: 'degustari',
        title: 'Degustări ghidate',
        description: 'Sesiuni cu somelieri din 12 vinării',
        start_time: '13:00',
        end_time: '18:00',
      },
      {
        id: 'concert',
        title: 'Concert Lupii lui Calancea',
        description: '',
        start_time: '20:00',
        end_time: '22:00',
      },
    ],
  };
  wineFestival.detail = { ...wineFestival.detail, ...extras };
  patchTicket(wineFestival, 51, {
    comment: 'Acces într-una din cele trei zile',
    show_remaining_tickets: true,
    quantity_discounts: [
      { min_quantity: 3, percent: 5 },
      { min_quantity: 5, percent: 10 },
    ],
  });
  patchTicket(wineFestival, 52, {
    comment: 'Acces în toate zilele + pahar de degustare',
    sale_end_date: `${isoDateTime(0, '23:59:00')}`,
  });
  patchTicket(wineFestival, 53, {
    comment: 'Masă pentru 4 persoane în zona lounge',
    is_table: true,
    qr_code_quantity: 4,
  });
}

enrich(4102, {
  categories: [categories[0]],
  coordinates: { lat: 47.0262, long: 28.8353 },
});
const warmup = enrich(4103, {
  categories: [categories[5]],
  coordinates: { lat: 46.7712, long: 23.6236 },
});
if (warmup) {
  patchTicket(warmup, 57, {
    is_active: false,
    sale_end_date: `${isoDateTime(-3, '23:59:00')}`,
  });
  patchTicket(warmup, 58, { show_remaining_tickets: true });
}
enrich(4104, {
  categories: [categories[2]],
  type: 'PRIVATE',
  coordinates: { lat: 47.0582, long: 28.8665 },
});
enrich(4105, {
  categories: [categories[3]],
  type: 'PERSONAL',
  coordinates: { lat: 47.1585, long: 27.5869 },
});
enrich(4106, {
  categories: [categories[9]],
  location_is_tba: true,
  address: '',
});

let stripeConnected = false;
let nextEventId = 4400;
let nextTicketId = 900;
let nextQuestionId = 800;
let nextCouponId = 1000;
let nextImageId = 90000;

type FormFields = Record<string, unknown[]>;

function readForm(body: unknown): FormFields {
  const fields: FormFields = {};
  const add = (key: string, value: unknown) => {
    fields[key] = [...(fields[key] ?? []), value];
  };
  if (typeof body !== 'object' || body === null) return fields;
  if ('getParts' in body && typeof body.getParts === 'function') {
    const parts: unknown = body.getParts();
    if (Array.isArray(parts)) {
      parts.forEach((part: unknown) => {
        if (typeof part === 'object' && part !== null && 'fieldName' in part && typeof part.fieldName === 'string') {
          add(part.fieldName, 'string' in part ? part.string : part);
        }
      });
    }
    return fields;
  }
  if ('forEach' in body && typeof body.forEach === 'function') {
    body.forEach((value: unknown, key: unknown) => {
      if (typeof key === 'string') add(key, value);
    });
  }
  return fields;
}

function text(fields: FormFields, key: string): string | undefined {
  const value = fields[key]?.[0];
  return typeof value === 'string' ? value : undefined;
}

function json(fields: FormFields, key: string): unknown {
  const raw = text(fields, key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    : [];
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function uriOf(value: unknown): string | null {
  return typeof value === 'object' && value !== null && 'uri' in value && typeof value.uri === 'string'
    ? value.uri
    : null;
}

function dayOffset(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const today = new Date();
  const target = new Date(year, (month || 1) - 1, day || 1);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function withSeconds(time: string | undefined, fallback: string): string {
  if (!time) return fallback;
  return time.length === 5 ? `${time}:00` : time;
}

function tiersOf(value: unknown): QuantityDiscountTier[] | null {
  const tiers = records(value).map((tier) => ({
    min_quantity: num(tier.min_quantity),
    percent: num(tier.percent),
  }));
  return tiers.length > 0 ? tiers : null;
}

function applyTickets(event: MockEvent, raw: unknown): void {
  const next: MockTicketType[] = records(raw).map((ticket) => {
    const existing = event.ticketTypes.find((candidate) => candidate.id === num(ticket.id, -1));
    const quantity = ticket.quantity == null ? null : num(ticket.quantity);
    return {
      id: existing?.id ?? nextTicketId++,
      name: str(ticket.name),
      price: num(ticket.price),
      quantity,
      sold: existing?.sold ?? 0,
      extra: {
        ...existing?.extra,
        comment: str(ticket.comment),
        sale_start_date: typeof ticket.sale_start_date === 'string' ? ticket.sale_start_date : null,
        sale_end_date: typeof ticket.sale_end_date === 'string' ? ticket.sale_end_date : null,
        is_active: ticket.is_active !== false,
        qr_code_quantity: num(ticket.qr_code_quantity, 1),
        show_remaining_tickets: ticket.show_remaining_tickets === true,
        is_table: ticket.is_table === true,
        event_day: typeof ticket.event_day === 'string' ? ticket.event_day : null,
        quantity_discounts: tiersOf(ticket.quantity_discounts),
      },
    };
  });
  if (next.length > 0) event.ticketTypes = next;
}

function couponsOf(raw: unknown, previous: EventCoupon[]): EventCoupon[] {
  return records(raw).map((coupon) => {
    const existing = previous.find((candidate) => candidate.id === num(coupon.id, -1));
    return {
      id: existing?.id ?? nextCouponId++,
      code: str(coupon.code),
      discount: num(coupon.discount),
      max_uses: num(coupon.max_uses),
      usage_count: existing?.usage_count ?? 0,
      is_active: coupon.is_active !== false,
    };
  });
}

function questionsOf(raw: unknown): StoredQuestion[] {
  return records(raw).map((question) => ({
    id: question.id != null ? num(question.id) : nextQuestionId++,
    question: str(question.question),
    description: str(question.description),
    type: QUESTION_TYPES.find((type) => type === question.type) ?? 'short_answer',
    options: Array.isArray(question.options)
      ? question.options.filter((option: unknown): option is string => typeof option === 'string')
      : [],
    conditions: Array.isArray(question.conditions) ? question.conditions : [],
    required: question.required === true,
  }));
}

function eventTypeOf(value: string | undefined): EventType {
  return value === 'PRIVATE' || value === 'PERSONAL' ? value : 'PUBLIC';
}

function mediaOf(fields: FormFields, previous: EventDetail['event_images']): NonNullable<EventDetail['event_images']> {
  const newPhotos = (fields.photos ?? []).map((photo) => ({
    id: nextImageId++,
    image: uriOf(photo) ?? PLACEHOLDER_PHOTO,
  }));
  const keptIds = records(json(fields, 'media_order'));
  const existing = previous ?? [];
  if (keptIds.length === 0) return newPhotos.map((photo, order) => ({ ...photo, order }));
  return keptIds.flatMap((entry, order) => {
    if (entry.type !== 'image') return [];
    if (entry.existing_image_id != null) {
      const found = existing.find((image) => image.id === num(entry.existing_image_id));
      return found ? [{ ...found, order }] : [];
    }
    const photo = newPhotos[num(entry.photo_index, -1)];
    return photo ? [{ ...photo, order }] : [];
  });
}

function applyScalars(event: MockEvent, fields: FormFields): void {
  const currency = text(fields, 'currency');
  const startDate = text(fields, 'start_date');
  const endDate = text(fields, 'end_date');
  event.name = text(fields, 'title') ?? event.name;
  event.description = text(fields, 'description') ?? event.description;
  if (startDate) event.startOffset = dayOffset(startDate);
  event.startTime = withSeconds(text(fields, 'start_time'), event.startTime);
  if (endDate) event.endOffset = dayOffset(endDate);
  event.endTime = withSeconds(text(fields, 'end_time'), event.endTime);
  if (currency === 'MDL' || currency === 'RON' || currency === 'EUR') event.currency = currency;
  event.country = text(fields, 'country') ?? event.country;
  event.region = text(fields, 'region') ?? event.region;
  event.address = text(fields, 'address') ?? event.address;
  event.inDraft = text(fields, 'in_draft') === 'true';
  applyTickets(event, json(fields, 'ticket_types'));

  const category = categories.find((candidate) => candidate.id === num(text(fields, 'category'), -1));
  const coordinates = json(fields, 'coordinates');
  const coordinate = records([coordinates])[0];
  const organizerIds = records(json(fields, 'organizers')).map((organizer) => num(organizer.id));
  const images = mediaOf(fields, event.detail?.event_images);
  const videoField = fields.video?.[0];
  const extras = {
    categories: category ? [category] : (event.detail?.categories ?? []),
    type: eventTypeOf(text(fields, 'type')),
    currency: currency ?? event.currency,
    time_is_tba: text(fields, 'time_is_tba') === 'true',
    event_location_type: text(fields, 'event_location_type') === 'virtual' ? 'virtual' : 'physical',
    location_is_tba: text(fields, 'location_is_tba') === 'true',
    coordinates: coordinate ? { lat: num(coordinate.lat), long: num(coordinate.long) } : undefined,
    organizers: organizerIds.map(organizerOf).filter((organizer): organizer is Organizer => organizer !== null),
    questions_data: questionsOf(json(fields, 'questions')),
    timelines: records(json(fields, 'timelines')),
    coupons: fields.coupons ? couponsOf(json(fields, 'coupons'), event.detail?.coupons ?? []) : event.detail?.coupons,
    ...(images.length > 0 ? { event_images: images, images: images.map((image) => image.image) } : {}),
    video:
      videoField === ''
        ? null
        : (uriOf(videoField) ?? (videoField ? PLACEHOLDER_PHOTO : (event.detail?.video ?? null))),
  };
  event.detail = { ...event.detail, ...extras };
  if (images[0]) event.poster = images[0].image;
}

function createEvent(request: MockRequest) {
  const fields = readForm(request.body);
  const owner = num(text(fields, 'owner'), currentMockUser(request).id);
  const event: MockEvent = {
    id: nextEventId++,
    ownerId: owner,
    name: '',
    poster: PLACEHOLDER_PHOTO,
    currency: 'EUR',
    country: '',
    region: '',
    address: '',
    startOffset: 0,
    startTime: '19:00:00',
    endOffset: 0,
    endTime: '23:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 0,
    ticketsScanned: 0,
    participants: 0,
    income: 0,
    hasPresale: false,
    description: '',
    ticketTypes: [],
  };
  applyScalars(event, fields);
  mockEvents.push(event);
  return { id: event.id, slug: `event-${event.id}`, title: event.name };
}

function updateEvent(request: MockRequest) {
  const event = findMockEvent(request.params.id);
  if (!event) return mockError(404, { detail: 'Not found.' });
  applyScalars(event, readForm(request.body));
  return { id: event.id, slug: `event-${event.id}`, title: event.name };
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/categories/', ({ query }) => paginate(categories, query, 100)),
  mock('POST', '/api/v1/events/', createEvent, { delay: 900 }),
  mock('PATCH', '/api/v1/events/:id/', updateEvent, { delay: 900 }),
  mock('GET', '/api/v1/users/organizations/', ({ query }) => {
    const needle = (query.query ?? '').trim().toLowerCase();
    const matches = organizations.filter((organization) =>
      [organization.organization_name, organization.first_name, organization.last_name]
        .filter((part): part is string => typeof part === 'string')
        .some((part) => part.toLowerCase().includes(needle)),
    );
    return paginate(matches, query, 20);
  }),
  mock('GET', '/api/v1/users/stripe_verified/', () => ({
    verified: stripeConnected,
  })),
  mock('POST', '/api/v1/users/stripe_connect/', () => {
    stripeConnected = true;
    return {
      onboard_link: 'https://connect.stripe.com/setup/e/acct_1Q2w3E4r5T6y7U8i/sunset-events',
    };
  }),
  mock('POST', '/api/v1/users/sign_contract/', {
    status: 'signed',
    signed_at: isoDate(0),
  }),
];
