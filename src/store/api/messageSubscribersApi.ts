import { eventEndpoint } from '@/lib/constants';

import { baseApi } from './baseApi';

const messagingEndpoints = {
  scheduleEmail: '/api/v1/users/schedule_email/',
  scheduledEmails: '/api/v1/users/scheduled_emails/',
  scheduledEmailDetail: (scheduledId: number) => `/api/v1/users/scheduled_emails/${scheduledId}/`,
} as const;

export interface MessagingRecipient {
  id: number;
  name: string;
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

interface RawJoinedPerson {
  id: number;
}

interface RawCreatedEvent {
  id: number;
  title?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  images?: string[] | null;
  categories?: string[] | null;
  joined_people_count?: number | null;
  joined_people?: RawJoinedPerson[] | null;
}

interface RawFollower {
  id: number;
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

function buildAudience(response: RawMessagingUser): MessagingAudience {
  const followers: MessagingRecipient[] = (response.followers ?? []).map((follower) => ({
    id: follower.id,
    name: followerName(follower),
    organizationName: follower.organization_name ?? null,
    isOrganization: Boolean(follower.is_organization),
    profileImage: follower.profile_image ?? null,
  }));

  const events: MessagingEvent[] = (response.created_events ?? []).map((event) => {
    const attendeeIds = (event.joined_people ?? []).map((person) => person.id);
    return {
      id: event.id,
      title: event.title ?? '',
      startDate: event.start_date ?? null,
      startTime: event.start_time ?? null,
      image: event.images?.[0] ?? null,
      categories: event.categories ?? [],
      attendeeIds,
      attendeeCount: event.joined_people_count ?? attendeeIds.length,
    };
  });

  const categoryMap = new Map<string, MessagingCategory>();
  for (const event of events) {
    const eventCategories = event.categories.length > 0 ? event.categories : ['Other'];
    for (const categoryName of eventCategories) {
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

const enhancedApi = baseApi.enhanceEndpoints({ addTagTypes: ['ScheduledEmails'] });

export const messageSubscribersApi = enhancedApi.injectEndpoints({
  endpoints: (builder) => ({
    getMessagingAudience: builder.query<MessagingAudience, number>({
      query: (userId) => eventEndpoint.user(userId),
      transformResponse: (response: RawMessagingUser) => buildAudience(response),
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
  useScheduleGroupEmailMutation,
  useGetScheduledEmailsQuery,
  useUpdateScheduledEmailMutation,
  useDeleteScheduledEmailMutation,
} = messageSubscribersApi;
