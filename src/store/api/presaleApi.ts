import { baseApi } from './baseApi';

export type PresaleState = 'COMING_SOON' | 'PRE_SALE_REGISTRATION' | 'PRE_SALE_LIVE' | 'PUBLIC_SALE';
export type PresaleNotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface PresaleRegistrationRow {
  id: number;
  email: string;
  phone: string;
  language: string;
  traffic_source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referrer: string;
  landing_url: string;
  notification_status: PresaleNotificationStatus;
  has_account: boolean;
  registered_at: string;
  notified_at: string | null;
  email_sent_at: string | null;
  sms_sent_at: string | null;
  push_sent_at: string | null;
}

export interface PresaleSummary {
  total: number;
  today: number;
  with_phone: number;
  with_account: number;
  new_leads: number;
  languages: { language: string; count: number }[];
  sources: { source: string; count: number }[];
  campaigns: { campaign: string; count: number }[];
  notifications: Record<PresaleNotificationStatus, number>;
}

export interface PresaleRegistrationsPage {
  registrations: PresaleRegistrationRow[];
  next_before: number | null;
}

export interface PresaleOrganizerResponse extends PresaleRegistrationsPage {
  presale: {
    enabled: boolean;
    state: PresaleState;
    starts_at: string | null;
    public_sale_starts_at: string | null;
    live_notified_at: string | null;
  };
  event: { id: number; title: string; starts_at: string };
  summary: PresaleSummary;
}

export interface PresaleRegistrationsParams {
  eventId: number;
  before?: number | null;
  q?: string;
  source?: string;
}

export interface PresaleStreamGrant {
  stream_token: string;
  expires_in: number;
}

export type PresaleStreamMessage =
  | { type: 'registration'; registration: PresaleRegistrationRow; summary: PresaleSummary }
  | { type: 'notifications' };

const organizerPath = (eventId: number) => `/api/v1/presale/events/${eventId}/organizer/`;

export const presaleEndpoints = {
  organizer: organizerPath,
  registrations: (eventId: number) => `${organizerPath(eventId)}registrations/`,
  streamToken: (eventId: number) => `${organizerPath(eventId)}stream-token/`,
  stream: (eventId: number, token: string) => `${organizerPath(eventId)}stream/?token=${encodeURIComponent(token)}`,
  export: (eventId: number) => `${organizerPath(eventId)}export/`,
};

export const presaleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPresaleOrganizer: builder.query<PresaleOrganizerResponse, number>({
      query: (eventId) => ({ url: presaleEndpoints.organizer(eventId) }),
      keepUnusedDataFor: 0,
    }),
    getPresaleRegistrations: builder.query<PresaleRegistrationsPage, PresaleRegistrationsParams>({
      query: ({ eventId, before, q, source }) => ({
        url: presaleEndpoints.registrations(eventId),
        params: { ...(before ? { before } : {}), ...(q ? { q } : {}), ...(source ? { source } : {}) },
      }),
      keepUnusedDataFor: 0,
    }),
    getPresaleStreamToken: builder.query<PresaleStreamGrant, number>({
      query: (eventId) => ({ url: presaleEndpoints.streamToken(eventId) }),
      keepUnusedDataFor: 0,
    }),
  }),
  overrideExisting: false,
});

export const {
  useLazyGetPresaleOrganizerQuery,
  useLazyGetPresaleRegistrationsQuery,
  useLazyGetPresaleStreamTokenQuery,
} = presaleApi;
