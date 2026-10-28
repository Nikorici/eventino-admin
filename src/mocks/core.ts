import { endpoints, eventEndpoint } from '@/lib/constants';
import type { LinkedAccount } from '@/store/api/linkedAccountsApi';
import type { OrganizerEventListItem } from '@/store/api/organizerApi';
import type { EventDetail, TicketType, User } from '@/types/api';

import { bodyOf, isoDate, mock, mockError, type MockHandler, type MockRequest } from './mock';

export const MOCK_USER_IS_STAFF = true;

export const mockOrganizer: User = {
  id: 1001,
  email: 'andrei.ciobanu@sunsetevents.md',
  first_name: 'Andrei',
  last_name: 'Ciobanu',
  organization_name: 'Sunset Events',
  is_organization: true,
  short_description: 'Concerte, festivaluri și conferințe în Moldova și România.',
  city: 'Chișinău',
  country: 'Moldova',
  phone_number: '+37369123456',
  profile_image: null,
  is_full_confirmation: true,
  is_email_confirmed: true,
  is_phone_number_confirmed: true,
  is_staff: MOCK_USER_IS_STAFF,
  badge_type: 'verified',
  events_created_count: 6,
  followers_count: 2480,
  registration_method: 'email',
  send_mail_permission: true,
};

export const mockLinkedOrganizers: User[] = [
  {
    id: 1002,
    email: 'office@jazzinchisinau.md',
    first_name: 'Ethno Jazz',
    last_name: 'Festival',
    organization_name: 'Ethno Jazz Festival',
    is_organization: true,
    city: 'Chișinău',
    country: 'Moldova',
    profile_image: null,
    is_full_confirmation: true,
    is_email_confirmed: true,
    is_staff: false,
    events_created_count: 2,
  },
  {
    id: 1003,
    email: 'contact@clujlive.ro',
    first_name: 'Cluj',
    last_name: 'Live',
    organization_name: 'Cluj Live Events SRL',
    is_organization: true,
    city: 'Cluj-Napoca',
    country: 'Romania',
    profile_image: null,
    is_full_confirmation: true,
    is_email_confirmed: true,
    is_staff: false,
    events_created_count: 2,
  },
];

export const mockUsers: User[] = [mockOrganizer, ...mockLinkedOrganizers];

const linkedNicknames: Record<number, string> = {
  1001: 'Sunset Events',
  1002: 'Ethno Jazz',
  1003: 'Cluj Live',
};

export interface MockTicketType {
  id: number;
  name: string;
  price: number;
  quantity: number | null;
  sold: number;
}

export interface MockEvent {
  id: number;
  ownerId: number;
  name: string;
  poster: string;
  currency: 'MDL' | 'RON' | 'EUR';
  country: string;
  region: string;
  address: string;
  startOffset: number;
  startTime: string;
  endOffset: number;
  endTime: string;
  inDraft: boolean;
  isCancelled: boolean;
  cancellationReason?: string;
  ticketsSold: number;
  ticketsScanned: number;
  participants: number;
  income: number;
  hasPresale: boolean;
  description: string;
  ticketTypes: MockTicketType[];
}

export const mockEvents: MockEvent[] = [
  {
    id: 4101,
    ownerId: 1001,
    name: 'Festivalul Vinului — Ediția de Toamnă',
    poster: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80',
    currency: 'MDL',
    country: 'Moldova',
    region: 'Chișinău',
    address: 'Piața Marii Adunări Naționale, Chișinău',
    startOffset: -1,
    startTime: '12:00:00',
    endOffset: 1,
    endTime: '23:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 1840,
    ticketsScanned: 1212,
    participants: 1795,
    income: 412500,
    hasPresale: true,
    description: 'Două zile de degustări cu peste 60 de vinării din Moldova, muzică live și gastronomie locală.',
    ticketTypes: [
      { id: 51, name: 'Acces o zi', price: 150, quantity: 1500, sold: 1120 },
      { id: 52, name: 'Abonament 2 zile', price: 250, quantity: 800, sold: 610 },
      { id: 53, name: 'VIP Lounge', price: 900, quantity: 120, sold: 110 },
    ],
  },
  {
    id: 4102,
    ownerId: 1001,
    name: 'Zdob și Zdub — Concert Aniversar',
    poster: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80',
    currency: 'MDL',
    country: 'Moldova',
    region: 'Chișinău',
    address: 'Palatul Republicii, str. Maria Cibotari 16, Chișinău',
    startOffset: 0,
    startTime: '23:30:00',
    endOffset: 1,
    endTime: '02:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 2310,
    ticketsScanned: 0,
    participants: 2204,
    income: 1039500,
    hasPresale: false,
    description: 'Concert aniversar cu cele mai iubite piese ale trupei, invitați speciali și o scenografie nouă.',
    ticketTypes: [
      { id: 54, name: 'Balcon', price: 350, quantity: 900, sold: 870 },
      { id: 55, name: 'Parter', price: 450, quantity: 1200, sold: 1180 },
      { id: 56, name: 'Loje VIP', price: 1200, quantity: 300, sold: 260 },
    ],
  },
  {
    id: 4103,
    ownerId: 1001,
    name: 'Electric Castle Warm-up Cluj',
    poster: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80',
    currency: 'RON',
    country: 'Romania',
    region: 'Cluj-Napoca',
    address: 'Form Space, Piezișă 2, Cluj-Napoca',
    startOffset: 12,
    startTime: '22:00:00',
    endOffset: 13,
    endTime: '06:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 640,
    ticketsScanned: 0,
    participants: 612,
    income: 76800,
    hasPresale: true,
    description: 'Noapte de muzică electronică cu artiști din line-up-ul festivalului.',
    ticketTypes: [
      { id: 57, name: 'Early Bird', price: 90, quantity: 300, sold: 300 },
      { id: 58, name: 'General Admission', price: 130, quantity: 700, sold: 340 },
    ],
  },
  {
    id: 4104,
    ownerId: 1001,
    name: 'Moldova IT Conference 2027',
    poster: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
    currency: 'EUR',
    country: 'Moldova',
    region: 'Chișinău',
    address: 'Tekwill, str. Studenților 9/11, Chișinău',
    startOffset: 90,
    startTime: '09:00:00',
    endOffset: 91,
    endTime: '18:00:00',
    inDraft: true,
    isCancelled: false,
    ticketsSold: 0,
    ticketsScanned: 0,
    participants: 0,
    income: 0,
    hasPresale: false,
    description: 'Conferință despre produse digitale, AI și export de servicii IT.',
    ticketTypes: [
      { id: 59, name: 'Standard', price: 49, quantity: 500, sold: 0 },
      { id: 60, name: 'Business', price: 149, quantity: 100, sold: 0 },
    ],
  },
  {
    id: 4105,
    ownerId: 1001,
    name: 'Stand-up Comedy Night Iași',
    poster: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=1200&q=80',
    currency: 'RON',
    country: 'Romania',
    region: 'Iași',
    address: 'Teatrul Luceafărul, str. Grigore Ureche 3, Iași',
    startOffset: -20,
    startTime: '19:30:00',
    endOffset: -20,
    endTime: '22:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 412,
    ticketsScanned: 398,
    participants: 405,
    income: 32960,
    hasPresale: false,
    description: 'Seară de stand-up cu cei mai buni comedianți din Iași și București.',
    ticketTypes: [
      { id: 61, name: 'Categoria I', price: 90, quantity: 250, sold: 248 },
      { id: 62, name: 'Categoria II', price: 70, quantity: 200, sold: 164 },
    ],
  },
  {
    id: 4106,
    ownerId: 1001,
    name: 'Open Air Cinema Valea Morilor',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=80',
    currency: 'MDL',
    country: 'Moldova',
    region: 'Chișinău',
    address: 'Parcul Valea Morilor, Chișinău',
    startOffset: 5,
    startTime: '20:30:00',
    endOffset: 5,
    endTime: '23:00:00',
    inDraft: false,
    isCancelled: true,
    cancellationReason: 'Prognoza meteo anunță ploi abundente.',
    ticketsSold: 86,
    ticketsScanned: 0,
    participants: 80,
    income: 8600,
    hasPresale: false,
    description: 'Proiecții de film sub cerul liber cu șezlonguri și food-trucks.',
    ticketTypes: [{ id: 63, name: 'Șezlong', price: 100, quantity: 300, sold: 86 }],
  },
  {
    id: 4201,
    ownerId: 1002,
    name: 'Ethno Jazz Festival 2026',
    poster: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1200&q=80',
    currency: 'MDL',
    country: 'Moldova',
    region: 'Chișinău',
    address: 'Sala cu Orgă, bd. Ștefan cel Mare 79, Chișinău',
    startOffset: 18,
    startTime: '19:00:00',
    endOffset: 20,
    endTime: '23:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 520,
    ticketsScanned: 0,
    participants: 498,
    income: 156000,
    hasPresale: false,
    description: 'Trei seri de jazz și muzică etno cu artiști din 12 țări.',
    ticketTypes: [{ id: 64, name: 'Abonament', price: 300, quantity: 800, sold: 520 }],
  },
  {
    id: 4301,
    ownerId: 1003,
    name: 'Untold Afterparty Cluj',
    poster: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
    currency: 'RON',
    country: 'Romania',
    region: 'Cluj-Napoca',
    address: 'Sala Polivalentă, Cluj-Napoca',
    startOffset: 30,
    startTime: '23:00:00',
    endOffset: 31,
    endTime: '05:00:00',
    inDraft: false,
    isCancelled: false,
    ticketsSold: 1200,
    ticketsScanned: 0,
    participants: 1150,
    income: 180000,
    hasPresale: true,
    description: 'Afterparty oficial cu DJ internaționali.',
    ticketTypes: [{ id: 65, name: 'General', price: 150, quantity: 2000, sold: 1200 }],
  },
];

export function mockTokenFor(userId: number): { access: string; refresh: string } {
  return { access: `mock-access-${userId}`, refresh: `mock-refresh-${userId}` };
}

export function currentMockUser(request: MockRequest): User {
  const match = request.token?.match(/^mock-access-(\d+)$/);
  const id = match ? Number(match[1]) : mockOrganizer.id;
  return mockUsers.find((user) => user.id === id) ?? mockOrganizer;
}

function userForEmail(email: unknown): User {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return mockUsers.find((user) => user.email === normalized) ?? mockOrganizer;
}

export function findMockEvent(id: number | string): MockEvent | undefined {
  return mockEvents.find((event) => event.id === Number(id));
}

export function eventsOf(user: User): MockEvent[] {
  return mockEvents.filter((event) => event.ownerId === user.id);
}

export function mockEventListItem(event: MockEvent): OrganizerEventListItem {
  return {
    id: event.id,
    name: event.name,
    image: event.poster,
    start_date: isoDate(event.startOffset),
    start_time: event.startTime,
    end_date: isoDate(event.endOffset),
    end_time: event.endTime,
    income: event.income,
    participants_count: event.participants,
    tickets_count: event.ticketsSold,
    country: event.country,
    currency: event.currency,
    region: event.region,
    in_draft: event.inDraft,
    is_cancelled: event.isCancelled,
  };
}

function mockTicketTypes(event: MockEvent): TicketType[] {
  return event.ticketTypes.map((ticketType) => ({
    id: ticketType.id,
    name: ticketType.name,
    price: ticketType.price.toFixed(2),
    currency: event.currency,
    quantity: ticketType.quantity,
    available_quantity: ticketType.quantity == null ? undefined : ticketType.quantity - ticketType.sold,
    qr_code_quantity: 1,
    show_remaining_tickets: false,
    is_active: !event.isCancelled,
    is_archived: false,
    is_table: false,
  }));
}

export function mockEventDetail(event: MockEvent): EventDetail {
  const owner = mockUsers.find((user) => user.id === event.ownerId) ?? mockOrganizer;
  return {
    id: event.id,
    title: event.name,
    slug: event.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
    start_date: isoDate(event.startOffset),
    start_time: event.startTime,
    end_date: isoDate(event.endOffset),
    end_time: event.endTime,
    images: [event.poster],
    event_images: [{ id: event.id, image: event.poster, order: 0 }],
    followers: [],
    type: 'PUBLIC',
    in_draft: event.inDraft,
    country: event.country,
    region: event.region,
    address: event.address,
    location_is_tba: false,
    time_is_tba: false,
    event_location_type: 'physical',
    owner_id: owner.id,
    currency: event.currency,
    categories: [],
    ticket_types: mockTicketTypes(event),
    description: event.description,
    owner: {
      id: owner.id,
      first_name: owner.first_name ?? '',
      last_name: owner.last_name ?? '',
      organization_name: owner.organization_name ?? null,
      profile_image: owner.profile_image ?? null,
      tva_percent: 0,
      tva_included_in_ticket_price: true,
    },
    organizers: [],
    has_presale: event.hasPresale,
    is_cancelled: event.isCancelled,
    cancellation_reason: event.cancellationReason ?? null,
    platform_fee_percent: 5,
    commission_vat_percent: 20,
    commission_paid_by: 'organizer',
    max_tickets_per_user: 10,
    attendee_info_fields: [],
    free_ticket_approval_enabled: false,
    allow_self_service_refunds: false,
    seat_map: null,
    is_staff_member: false,
    staff_permissions: null,
    is_account_delegate: false,
    delegate_permissions: null,
  };
}

function linkedAccountOf(user: User): LinkedAccount {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    profile_image: user.profile_image ?? null,
    nickname: linkedNicknames[user.id] ?? null,
  };
}

function sessionFor(user: User) {
  const tokens = mockTokenFor(user.id);
  return { ...tokens, user };
}

export const handlers: MockHandler[] = [
  mock('POST', endpoints.passwordLogin, (request: MockRequest) => mockTokenFor(userForEmail(bodyOf<{ email: string }>(request).email).id)),
  mock('POST', endpoints.sendOtpLogin, { status: 200, user_exists: true, message: 'OTP sent' }),
  mock('POST', endpoints.resendOtpLogin, { message: 'OTP sent' }),
  mock('POST', endpoints.verifyOtpLogin, (request: MockRequest) => ({
    status: 200,
    ...sessionFor(userForEmail(bodyOf<{ email: string }>(request).email)),
    is_new_account: false,
  })),
  mock('POST', endpoints.socialLogin, () => {
    const tokens = mockTokenFor(mockOrganizer.id);
    return { access_token: tokens.access, refresh_token: tokens.refresh, user: mockOrganizer };
  }),
  mock('POST', endpoints.register, { status: 201, message: 'Account created' }),
  mock('POST', endpoints.verifyEmail, { status: 200 }),
  mock('POST', endpoints.resendVerifyEmail, { status: 200 }),
  mock('POST', endpoints.userLogin, (request: MockRequest) => userForEmail(bodyOf<{ email: string }>(request).email)),
  mock('POST', endpoints.sendResetCode, { status: 200, message: 'Code sent' }),
  mock('POST', endpoints.verifyResetCode, { status: 200, reset_token: 'mock-reset-token' }),
  mock('POST', endpoints.resendResetCode, { status: 200 }),
  mock('POST', endpoints.resetPassword, { status: 200 }),
  mock('POST', endpoints.changePassword, (request: MockRequest) => ({ status: 200, ...mockTokenFor(currentMockUser(request).id) })),
  mock('POST', endpoints.tokenRefresh, (request: MockRequest) => ({ access: mockTokenFor(currentMockUser(request).id).access })),

  mock('GET', '/api/v1/users/:id/', (request: MockRequest) => {
    const user = mockUsers.find((candidate) => candidate.id === Number(request.params.id));
    return user ?? mockError(404, { detail: 'Not found.' });
  }),
  mock('GET', endpoints.linkedAccounts, (request: MockRequest) => {
    const current = currentMockUser(request);
    return mockUsers.filter((user) => user.id !== current.id).map(linkedAccountOf);
  }),
  mock('POST', `${endpoints.switchAccount}:id/`, (request: MockRequest) => {
    const user = mockUsers.find((candidate) => candidate.id === Number(request.params.id));
    return user ? sessionFor(user) : mockError(404, { detail: 'Not found.' });
  }),
  mock('DELETE', `${endpoints.linkedAccounts}:id/`, {}),
  mock('GET', '/api/v1/account-delegates/my-delegators/', []),

  mock('POST', '/api/v1/statistics/event-list/', (request: MockRequest) => {
    const events = eventsOf(currentMockUser(request)).map(mockEventListItem);
    return { events, total: events.length, page: 1, page_size: 1000 };
  }),
  mock('GET', eventEndpoint.detail(':id'), (request: MockRequest) => {
    const event = findMockEvent(request.params.id);
    return event ? mockEventDetail(event) : mockError(404, { detail: 'Not found.' });
  }),
  mock('GET', '/api/v1/tickets/scanned/', { count: 0, next: null, previous: null, results: [] }),
];
