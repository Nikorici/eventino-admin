import { endpoints } from '@/lib/constants';

import { baseApi } from './baseApi';

export interface RegisterNotificationTokenBody {
  token: string;
  device: string;
  device_type: string;
}

export interface UserNotification {
  id: number;
  sender?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  sender_profile_image?: string | null;
  message: string;
  time?: string | null;
  event_id?: number | null;
}

type NotificationsResponse = UserNotification[] | { notifications?: UserNotification[]; results?: UserNotification[] };

function normalize(response: NotificationsResponse): UserNotification[] {
  if (Array.isArray(response)) return response;
  return response?.notifications ?? response?.results ?? [];
}

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserNotifications: builder.query<UserNotification[], number>({
      query: (userId) => ({ url: `/api/v1/users/${userId}/user_notifications/`, method: 'GET' }),
      transformResponse: (response: NotificationsResponse) => normalize(response).slice().reverse(),
      providesTags: ['Notifications'],
    }),
    clearNotifications: builder.mutation<void, void>({
      query: () => ({ url: '/api/v1/notifications/delete-all/', method: 'DELETE' }),
      invalidatesTags: ['Notifications'],
    }),
    respondInvitation: builder.mutation<void, { eventId: number; response: 'accept' | 'decline' }>({
      query: ({ eventId, response }) => ({
        url: `/api/v1/events/${eventId}/respond-invitation/`,
        method: 'POST',
        body: { response },
      }),
      invalidatesTags: ['Notifications'],
    }),
    registerNotificationToken: builder.mutation<unknown, RegisterNotificationTokenBody>({
      query: (body) => ({ url: endpoints.notificationToken, method: 'POST', body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUserNotificationsQuery,
  useClearNotificationsMutation,
  useRespondInvitationMutation,
  useRegisterNotificationTokenMutation,
} = notificationsApi;
