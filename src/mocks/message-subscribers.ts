import type {
  EmailPreviewBody,
  ScheduledEmail,
  ScheduleGroupEmailBody,
  SendTicketHoldersEmailBody,
  TicketHolderType,
  UpdateScheduledEmailBody,
} from '@/store/api/messageSubscribersApi';

import { eventsOf, findMockEvent, mockLinkedOrganizers, mockOrganizer, mockUsers, type MockEvent } from './core';
import { bodyOf, isoDate, mock, mockError, paginate, type MockHandler } from './mock';

const clujLive = mockLinkedOrganizers[1];

const followerFixtures: { id: number; first_name: string; last_name: string; email: string; events: number[]; organization?: string }[] = [
  { id: 2110, first_name: 'Ana', last_name: 'Popescu', email: 'ana.popescu@gmail.com', events: [4101, 4102, 4105] },
  { id: 2101, first_name: 'Ion', last_name: 'Rusu', email: 'ion.rusu@gmail.com', events: [4101] },
  { id: 2102, first_name: 'Maria', last_name: 'Ciobanu', email: 'maria.ciobanu@gmail.com', events: [4101, 4102, 4103, 4105] },
  { id: clujLive.id, first_name: '', last_name: '', email: clujLive.email, events: [4102, 4103], organization: 'Cluj Live Events SRL' },
  { id: 2103, first_name: 'Andrei', last_name: 'Lungu', email: 'andrei.lungu@gmail.com', events: [4101, 4103] },
  { id: 2104, first_name: 'Elena', last_name: 'Cojocaru', email: 'elena.cojocaru@gmail.com', events: [4106] },
  { id: 2105, first_name: 'Victor', last_name: 'Munteanu', email: 'victor.munteanu@gmail.com', events: [4101, 4102, 4103, 4105, 4106] },
  { id: 2106, first_name: 'Cristina', last_name: 'Botnaru', email: 'cristina.botnaru@gmail.com', events: [4102, 4106] },
  { id: 2109, first_name: 'Mihai', last_name: 'Ceban', email: 'mihai.ceban@gmail.com', events: [4105] },
  { id: 2113, first_name: 'Irina', last_name: 'Bivol', email: 'irina.bivol@gmail.com', events: [4101, 4102, 4103] },
  { id: 2111, first_name: 'Sergiu', last_name: 'Țurcanu', email: 'sergiu.turcanu@gmail.com', events: [4102] },
];

const eventCategories: Record<number, string> = {
  4101: 'Festival',
  4102: 'Concert',
  4103: 'Party',
  4104: 'Conference',
  4105: 'Comedy',
  4106: 'Cinema',
  4201: 'Festival',
  4301: 'Party',
};

function followersOf(userId: number) {
  if (userId !== mockOrganizer.id) return [];
  return followerFixtures.map((follower) => ({
    id: follower.id,
    first_name: follower.first_name,
    last_name: follower.last_name,
    email: follower.email,
    profile_image: null,
    is_organization: Boolean(follower.organization),
    organization_name: follower.organization ?? null,
  }));
}

function attendeesOf(event: MockEvent): number[] {
  const followerIds = followerFixtures.filter((follower) => follower.events.includes(event.id)).map((follower) => follower.id);
  const fillerCount = Math.max(0, event.participants - followerIds.length);
  return [...followerIds, ...Array.from({ length: fillerCount }, (_, index) => event.id * 10000 + index)];
}

function createdEvent(event: MockEvent) {
  return {
    id: event.id,
    title: event.name,
    start_date: isoDate(event.startOffset),
    start_time: event.startTime,
    images: [event.poster],
    categories: [eventCategories[event.id] ?? 'Other'],
    joined_people_count: event.participants,
    joined_people: attendeesOf(event),
  };
}

function inHours(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString().replace('Z', '+00:00');
}

function scheduled(
  id: number,
  subject: string,
  scheduledFor: string,
  status: string,
  eventId: number,
  message: string,
): ScheduledEmail {
  const event = findMockEvent(eventId);
  const recipients = event ? attendeesOf(event) : [];
  return {
    id,
    subject,
    message,
    scheduled_for: scheduledFor,
    status,
    recipient_count: recipients.length,
    recipients,
    attachments: [],
    created_at: inHours(-72),
    updated_at: inHours(-72),
  };
}

const scheduledEmails: ScheduledEmail[] = [
  scheduled(
    41,
    'Day 2 program and parking info',
    inHours(20),
    'PENDING',
    4101,
    '<p>Bună ziua! Ziua a doua a festivalului începe la 12:00.</p><p>Parcarea gratuită este disponibilă pe str. Ismail.</p>',
  ),
  scheduled(
    40,
    'Zdob și Zdub: doors open at 22:30',
    inHours(4),
    'PENDING',
    4102,
    '<p>Ușile Palatului Republicii se deschid la 22:30. Vă rugăm să aveți biletul pregătit pe telefon.</p>',
  ),
  scheduled(
    38,
    'Electric Castle Warm-up: Early Bird sold out',
    inHours(-30),
    'FAILED',
    4103,
    '<p>Biletele Early Bird s-au epuizat. General Admission este încă disponibil.</p>',
  ),
  scheduled(
    35,
    'Thank you for coming to Stand-up Comedy Night',
    inHours(-19 * 24),
    'SENT',
    4105,
    '<p>Mulțumim că ați fost alături de noi la Iași!</p>',
  ),
];

function isFuture(value: string | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time > Date.now() + 60 * 1000;
}

function addScheduled(recipients: number[], recipientCount: number, body: Partial<ScheduleGroupEmailBody>): ScheduledEmail {
  const scheduledFor = body.scheduled_for || inHours(0);
  const created: ScheduledEmail = {
    id: Math.max(0, ...scheduledEmails.map((email) => email.id)) + 1,
    subject: body.subject ?? '',
    message: body.message ?? '',
    scheduled_for: scheduledFor,
    status: isFuture(scheduledFor) ? 'PENDING' : 'SENT',
    recipient_count: recipientCount,
    recipients,
    attachments: body.attachments ?? [],
    created_at: inHours(0),
    updated_at: inHours(0),
  };
  scheduledEmails.unshift(created);
  return created;
}

function ticketHolderTypes(eventId: number): TicketHolderType[] {
  const event = findMockEvent(eventId);
  if (!event) return [];
  return event.ticketTypes.map((ticketType) => ({
    id: ticketType.id,
    name: ticketType.name,
    holder_count: Math.round(ticketType.sold * 0.93),
  }));
}

function previewHtml(subject: string, message: string): string {
  return [
    '<html><head><style>body{font-family:Arial,sans-serif;color:#2b3a44}</style></head><body>',
    `<h1>${subject}</h1>`,
    message,
    `<p>${mockOrganizer.organization_name ?? ''}</p>`,
    '<p>You received this email because you follow this organizer on Eventino.</p>',
    '<p>Unsubscribe</p>',
    '</body></html>',
  ].join('');
}

for (const user of mockUsers) {
  Object.assign(user, { followers: followersOf(user.id), created_events: eventsOf(user).map(createdEvent) });
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/users/scheduled_emails/', ({ query }) => paginate(scheduledEmails, query, 50)),
  mock('POST', '/api/v1/users/schedule_email/', (request) => {
    const body = bodyOf<ScheduleGroupEmailBody>(request);
    const recipients = body.recipients ?? [];
    if (recipients.length === 0) return mockError(400, { error: 'No recipients' });
    const created = addScheduled(recipients, recipients.length, body);
    return { id: created.id, status: created.status, scheduled_for: created.scheduled_for, recipient_count: created.recipient_count };
  }),
  mock('PATCH', '/api/v1/users/scheduled_emails/:id/', (request) => {
    const index = scheduledEmails.findIndex((email) => email.id === Number(request.params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    if (scheduledEmails[index].status !== 'PENDING') return mockError(400, { error: 'Only pending emails can be edited' });
    const body = bodyOf<UpdateScheduledEmailBody>(request);
    scheduledEmails[index] = {
      ...scheduledEmails[index],
      subject: body.subject ?? scheduledEmails[index].subject,
      message: body.message ?? scheduledEmails[index].message,
      scheduled_for: body.scheduled_for ?? scheduledEmails[index].scheduled_for,
      attachments: body.attachments ?? scheduledEmails[index].attachments,
      updated_at: inHours(0),
    };
    const updated = scheduledEmails[index];
    return { id: updated.id, status: updated.status, scheduled_for: updated.scheduled_for, recipient_count: updated.recipient_count };
  }),
  mock('DELETE', '/api/v1/users/scheduled_emails/:id/', ({ params }) => {
    const index = scheduledEmails.findIndex((email) => email.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    if (scheduledEmails[index].status !== 'PENDING') return mockError(400, { error: 'Only pending emails can be cancelled' });
    scheduledEmails.splice(index, 1);
    return { deleted: true };
  }),
  mock('POST', '/api/v1/users/bulk_email_preview/', (request) => {
    const body = bodyOf<EmailPreviewBody>(request);
    if (!body.subject?.trim()) return mockError(400, { error: 'Subject is required' });
    return { html: previewHtml(body.subject.trim(), body.message ?? '') };
  }),
  mock('POST', '/api/v1/statistics/get-ticket-holders-emails/', (request) => {
    const body = bodyOf<{ event_id: number }>(request);
    const ticketTypes = ticketHolderTypes(Number(body.event_id));
    const holders = ticketTypes.reduce((sum, ticketType) => sum + ticketType.holder_count, 0);
    return { ticket_types: ticketTypes, recipients: [], total_unique_emails: Math.round(holders * 0.96) };
  }),
  mock('POST', '/api/v1/statistics/send-email-to-ticket-holders/', (request) => {
    const body = bodyOf<SendTicketHoldersEmailBody>(request);
    const selected = new Set(body.ticket_type_ids ?? []);
    const total = ticketHolderTypes(Number(body.event_id))
      .filter((ticketType) => selected.has(ticketType.id))
      .reduce((sum, ticketType) => sum + ticketType.holder_count, 0);
    if (total === 0) return mockError(400, { error: 'No recipients found for the selected ticket types' });
    const created = addScheduled([], total, body);
    return { total_recipients: total, scheduled_for: created.scheduled_for };
  }),
];
