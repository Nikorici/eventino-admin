import { eventEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

const messagingEndpoints = {
  scheduleEmail: '/api/v1/users/schedule_email/',
  scheduledEmails: '/api/v1/users/scheduled_emails/',
  scheduledEmailDetail: (scheduledId: number) => `/api/v1/users/scheduled_emails/${scheduledId}/`,
  bulkEmailPreview: '/api/v1/users/bulk_email_preview/',
  ticketHoldersEmails: '/api/v1/statistics/get-ticket-holders-emails/',
  sendEmailToTicketHolders: '/api/v1/statistics/send-email-to-ticket-holders/',
} as const;

export interface MessagingRecipient {
  id: number;
  name: string;
  email: string | null;
  eventIds: number[];
  organizationName: string | null;
  isOrganization: boolean;
  profileImage: string | null;
}

export interface MessagingEvent {
  id: number;
  title: string;
  startDate: string | null;
  startTime: string | null;
  image: string | null;
  category: string;
  categories: string[];
  attendeeIds: number[];
  attendeeCount: number;
}

export interface MessagingCategory {
  id: string;
  name: string;
  eventCount: number;
  attendeeCount: number;
}

export interface MessagingAudience {
  followers: MessagingRecipient[];
  events: MessagingEvent[];
  categories: MessagingCategory[];
}

export interface GroupEmailAttachment {
  name: string;
  content: string;
  content_type: string;
}

export interface ScheduleGroupEmailBody {
  recipients: number[];
  subject: string;
  message: string;
  scheduled_for: string;
  attachments: GroupEmailAttachment[];
}

export interface UpdateScheduledEmailBody {
  id: number;
  subject: string;
  message: string;
  scheduled_for: string;
  attachments: GroupEmailAttachment[];
}

export interface ScheduleGroupEmailResponse {
  id: number;
  status: string;
  scheduled_for: string;
  recipient_count: number;
}

export interface EmailPreviewBody {
  subject: string;
  message: string;
}

export interface EmailPreviewResponse {
  html: string;
}

export interface TicketHolderType {
  id: number;
  name: string;
  holder_count: number;
}

export interface TicketHoldersSummary {
  ticket_types: TicketHolderType[];
  total_unique_emails: number;
}

export interface SendTicketHoldersEmailBody {
  event_id: number;
  ticket_type_ids: number[];
  subject: string;
  message: string;
  attachments: GroupEmailAttachment[];
  scheduled_for: string;
}

export interface SendTicketHoldersEmailResponse {
  total_recipients: number;
  scheduled_for: string;
}

export interface ScheduledEmail {
  id: number;
  subject: string;
  message: string;
  scheduled_for: string | null;
  status: string;
  recipient_count: number;
  recipients: number[];
  attachments: GroupEmailAttachment[];
  created_at: string | null;
  updated_at: string | null;
}

type RawJoinedPerson = number | { id: number };

interface RawCreatedEvent {
  id: number;
  title?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  images?: string[] | null;
  categories?: string[] | null;
  category?: string | null;
  joined_people_count?: number | null;
  joined_people?: RawJoinedPerson[] | null;
}

interface RawFollower {
  id: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  is_organization?: boolean;
  profile_image?: string | null;
}

interface RawMessagingUser {
  followers?: RawFollower[] | null;
  created_events?: RawCreatedEvent[] | null;
}

interface RawScheduledEmailsResponse {
  results?: ScheduledEmail[];
}

function followerName(follower: RawFollower): string {
  if (follower.is_organization && follower.organization_name) return follower.organization_name;
  const fullName = `${follower.first_name ?? ''} ${follower.last_name ?? ''}`.trim();
  if (fullName.length > 0) return fullName;
  return follower.organization_name ?? '';
}

function categoryKey(categoryName: string): string {
  return `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`;
}

export function eventStartAt(event: Pick<MessagingEvent, 'startDate' | 'startTime'>): Date | null {
  if (!event.startDate) return null;
  const startAt = new Date(`${event.startDate}T${event.startTime ?? '00:00:00'}`);
  return Number.isNaN(startAt.getTime()) ? null : startAt;
}

function upcomingFirst(a: MessagingEvent, b: MessagingEvent, now: number): number {
  const aTime = eventStartAt(a)?.getTime() ?? now;
  const bTime = eventStartAt(b)?.getTime() ?? now;
  const aPast = aTime < now;
  const bPast = bTime < now;
  if (aPast !== bPast) return aPast ? 1 : -1;
  return aPast ? bTime - aTime : aTime - bTime;
}

function buildAudience(response: RawMessagingUser, now = Date.now()): MessagingAudience {
  const events: MessagingEvent[] = (response.created_events ?? [])
    .map((event) => {
      const attendeeIds = (event.joined_people ?? []).map((person) => (typeof person === 'number' ? person : person.id));
      const categories =
        event.categories && event.categories.length > 0 ? event.categories : event.category ? [event.category] : ['Other'];
      return {
        id: event.id,
        title: event.title ?? '-',
        startDate: event.start_date ?? null,
        startTime: event.start_time ?? null,
        image: event.images?.[0] ?? null,
        category: categories[0],
        categories,
        attendeeIds,
        attendeeCount: event.joined_people_count ?? 0,
      };
    })
    .sort((a, b) => upcomingFirst(a, b, now));

  const eventIdsByAttendee = new Map<number, number[]>();
  for (const event of events) {
    for (const attendeeId of event.attendeeIds) {
      eventIdsByAttendee.set(attendeeId, [...(eventIdsByAttendee.get(attendeeId) ?? []), event.id]);
    }
  }

  const followers: MessagingRecipient[] = (response.followers ?? []).map((follower) => ({
    id: follower.id,
    name: followerName(follower),
    email: follower.email ?? null,
    eventIds: eventIdsByAttendee.get(follower.id) ?? [],
    organizationName: follower.organization_name ?? null,
    isOrganization: Boolean(follower.is_organization),
    profileImage: follower.profile_image ?? null,
  }));

  const categoryMap = new Map<string, MessagingCategory>();
  for (const event of events) {
    for (const categoryName of event.categories) {
      const id = categoryKey(categoryName);
      const existing = categoryMap.get(id);
      if (existing) {
        existing.eventCount += 1;
        existing.attendeeCount += event.attendeeCount;
      } else {
        categoryMap.set(id, {
          id,
          name: categoryName,
          eventCount: 1,
          attendeeCount: event.attendeeCount,
        });
      }
    }
  }

  return { followers, events, categories: Array.from(categoryMap.values()) };
}

const enhancedApi = baseApi.enhanceEndpoints({ addTagTypes: ['ScheduledEmails', 'MessagingAudience'] });

export const messageSubscribersApi = enhancedApi.injectEndpoints({
  endpoints: (builder) => ({
    getMessagingAudience: builder.query<MessagingAudience, number>({
      query: (userId) => eventEndpoint.user(userId),
      transformResponse: (response: RawMessagingUser) => buildAudience(response),
      providesTags: ['MessagingAudience'],
    }),
    getEmailPreview: builder.mutation<EmailPreviewResponse, EmailPreviewBody>({
      query: (body) => ({
        url: messagingEndpoints.bulkEmailPreview,
        method: 'POST',
        body,
      }),
    }),
    getTicketHolders: builder.query<TicketHoldersSummary, number>({
      query: (eventId) => ({
        url: messagingEndpoints.ticketHoldersEmails,
        method: 'POST',
        body: { event_id: eventId },
      }),
      transformResponse: (response: Partial<TicketHoldersSummary>) => ({
        ticket_types: response.ticket_types ?? [],
        total_unique_emails: response.total_unique_emails ?? 0,
      }),
    }),
    sendEmailToTicketHolders: builder.mutation<SendTicketHoldersEmailResponse, SendTicketHoldersEmailBody>({
      query: (body) => ({
        url: messagingEndpoints.sendEmailToTicketHolders,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ScheduledEmails'],
    }),
    scheduleGroupEmail: builder.mutation<ScheduleGroupEmailResponse, ScheduleGroupEmailBody>({
      query: (body) => ({
        url: messagingEndpoints.scheduleEmail,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ScheduledEmails'],
    }),
    getScheduledEmails: builder.query<ScheduledEmail[], void>({
      query: () => messagingEndpoints.scheduledEmails,
      transformResponse: (response: RawScheduledEmailsResponse) => response.results ?? [],
      providesTags: ['ScheduledEmails'],
    }),
    updateScheduledEmail: builder.mutation<ScheduleGroupEmailResponse, UpdateScheduledEmailBody>({
      query: ({ id, ...body }) => ({
        url: messagingEndpoints.scheduledEmailDetail(id),
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['ScheduledEmails'],
    }),
    deleteScheduledEmail: builder.mutation<{ deleted?: boolean }, number>({
      query: (scheduledId) => ({
        url: messagingEndpoints.scheduledEmailDetail(scheduledId),
        method: 'DELETE',
      }),
      invalidatesTags: ['ScheduledEmails'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMessagingAudienceQuery,
  useGetEmailPreviewMutation,
  useGetTicketHoldersQuery,
  useSendEmailToTicketHoldersMutation,
  useScheduleGroupEmailMutation,
  useGetScheduledEmailsQuery,
  useUpdateScheduledEmailMutation,
  useDeleteScheduledEmailMutation,
} = messageSubscribersApi;
