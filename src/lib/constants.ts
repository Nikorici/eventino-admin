export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.eventino.co';
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
export const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY ?? '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';

export const AUTH_SCHEME = 'ThemydaAPI';

export const STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  userEmail: 'userEmail',
  userId: 'userID',
  cachedUser: 'cachedUser',
  language: 'language',
  userCountry: 'userCountry',
  themePreference: 'themePreference',
  selectedEvent: 'selectedEvent',
} as const;

export const endpoints = {
  passwordLogin: '/api/login/',
  register: '/api/register/',
  socialLogin: '/api/v1/auth/social-login',
  userLogin: '/api/v1/users/user_login/',
  tokenRefresh: '/api/token/refresh/',
  verifyEmail: '/api/v1/verifications/verify_email/',
  resendVerifyEmail: '/api/v1/verifications/verify_email/resend_mail/',
  sendOtpLogin: '/api/v1/verifications/send_otp_login/',
  verifyOtpLogin: '/api/v1/verifications/verify_otp_login/',
  resendOtpLogin: '/api/v1/verifications/resend_otp_login/',
  sendResetCode: '/api/v1/verifications/send_code_reset_password/',
  verifyResetCode: '/api/v1/verifications/verify_code_reset_password/',
  resendResetCode: '/api/v1/verifications/verify_code_reset_password/resend_mail/',
  resetPassword: '/api/password_reset/',
  changePassword: '/api/change_password/',

  events: '/api/v1/events/',
  newEvents: '/api/v1/new_events/',
  featuredEvents: '/api/v1/events/is_featured_events/',
  recommendedEvents: '/api/v1/events/featured_events/',
  countries: '/api/v1/events/countries/',
  categories: '/api/v1/categories/',
  eventCoupons: '/api/v1/event_coupons/verify/',

  tickets: '/api/v1/tickets/',
  ticketOrders: '/api/v1/ticket-orders/',
  ticketTypesByEvent: '/api/v1/ticket-types/by-event/',

  users: '/api/v1/users/',
  companies: '/api/v1/companies/',
  switchAccount: '/api/v1/auth/switch/',
  linkedAccounts: '/api/v1/linked-accounts/',
  notificationToken: '/api/v1/notification/notification_token/',
} as const;

export const eventEndpoint = {
  detail: (id: number | string) => `/api/v1/events/${id}/`,
  answerQuestions: (id: number | string) => `/api/v1/events/${id}/answer_questions/`,
  subscription: (id: number | string) => `/api/v1/events/${id}/event_subscription/`,
  hasBoughtTickets: (id: number | string) => `/api/v1/events/${id}/has-bought-tickets/`,
  qrCode: (ticketId: number | string) => `/api/v1/tickets/${ticketId}/qr-code/`,
  order: (orderId: number | string) => `/api/v1/ticket-orders/${orderId}/`,
  syncOrderPayment: (orderId: number | string) => `/api/v1/ticket-orders/${orderId}/sync-payment/`,
  refundEligibility: (orderId: number | string) => `/api/v1/ticket-orders/${orderId}/refund-eligibility/`,
  requestRefund: (orderId: number | string) => `/api/v1/ticket-orders/${orderId}/request-refund/`,
  user: (id: number | string) => `/api/v1/users/${id}/`,
  ticketPass: (ticketId: number | string) => `/api/v1/tickets/${ticketId}/get-ticket-pass/`,
  orderTicketsPdf: (orderId: number | string) => `/api/v1/tickets/download-order-ticket/?order_id=${orderId}`,
  userSubscription: (userId: number | string) => `/api/v1/users/${userId}/user_subscription/`,
  eventSettlementPdf: (eventId: number | string) => `/api/v1/tickets/download-event-settlement/?event_id=${eventId}`,
  actPredarePdf: (eventId: number | string) => `/api/v1/tickets/download-act-predare-primire/?event_id=${eventId}`,
  ticketsExport: '/api/v1/statistics/get-tickets-export/',
  seatMap: (eventId: number | string) => `/api/v1/events/${eventId}/seat-map/`,
  seatStatus: (eventId: number | string) => `/api/v1/events/${eventId}/seats/status/`,
  seatStream: (eventId: number | string) => `/api/v1/events/${eventId}/seats/stream/`,
  seatHold: (eventId: number | string) => `/api/v1/events/${eventId}/seats/hold/`,
  seatValidate: (eventId: number | string) => `/api/v1/events/${eventId}/seats/validate/`,
};

export const privateOfferEndpoint = {
  list: '/api/v1/private_offers/',
  byEvent: (eventId: number | string) => `/api/v1/private_offers/by-event/?event_id=${eventId}`,
  cancel: (offerId: number | string) => `/api/v1/private_offers/${offerId}/cancel/`,
  sendInstallmentEmail: (offerId: number | string) => `/api/v1/private_offers/${offerId}/send-installment-email/`,
  quote: (eventId: number | string, amount: string) => `/api/v1/private_offers/quote/?event_id=${eventId}&amount=${encodeURIComponent(amount)}`,
  byToken: (token: string) => `/api/v1/private_offers/token/${encodeURIComponent(token)}/`,
  payInstallment: '/api/v1/tickets/pay-installment/',
} as const;

export const accountingEndpoint = {
  event: (eventId: number | string) => `/api/v1/event_accounting/event/${eventId}/`,
  transfers: (eventId: number | string) => `/api/v1/event_transfers/event/${eventId}/`,
  transfer: (eventId: number | string, transferId: number | string) => `/api/v1/event_transfers/event/${eventId}/${transferId}/`,
  romaniaSettlementsArchive: (dateFrom: string, dateTo: string) =>
    `/api/v1/tickets/download-romania-settlements/?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
} as const;

export const venueEndpoint = {
  venues: '/api/v1/venues/',
  venue: (venueId: number | string) => `/api/v1/venues/${venueId}/`,
  zone: (zoneId: number | string) => `/api/v1/zones/${zoneId}/`,
  assignVenue: '/api/v1/event-venues/assign_venue/',
  assignZone: '/api/v1/event-zones/assign_to_event/',
  eventZone: (eventZoneId: number | string) => `/api/v1/event-zones/${eventZoneId}/`,
  seatMapConfig: (eventId: number | string) => `/api/v1/events/${eventId}/seat-map/config/`,
  venueLayout: (layoutId: number | string) => `/api/v1/venue-layouts/${layoutId}/`,
} as const;

export const organizerTicketEndpoint = {
  eventTickets: (eventId: number | string) => `/api/v1/tickets/event-tickets/?event_id=${eventId}`,
  setDisplayName: (ticketId: number | string) => `/api/v1/tickets/${ticketId}/set-display-name/`,
  cancelEvent: (eventId: number | string) => `/api/v1/events/${eventId}/cancel-event/`,
  merchOrdersExport: (eventId: number | string) => `/api/v1/merch/orders/export/?event=${eventId}`,
} as const;

export const checkinEndpoint = {
  ticket: (ticketId: number | string) => `/api/v1/checkin/tickets/${ticketId}/`,
  submit: (ticketId: number | string) => `/api/v1/checkin/tickets/${ticketId}/submit/`,
  wallet: (ticketId: number | string) => `/api/v1/checkin/tickets/${ticketId}/wallet/`,
  topUp: (ticketId: number | string, provider: string) => `/api/v1/checkin/tickets/${ticketId}/topup/${provider}/`,
  myTickets: '/api/v1/checkin/my/tickets/',
} as const;

export const WEB_ORIGIN = 'https://www.eventino.co';

export const HIDDEN_EVENT_IDS = new Set<number>([984]);

export const SINGLE_TICKET_EVENT_IDS = [1026, 1068, 1082, 985, 1110, 1379, 1405, 1545, 1550];

export const PAYMENT_METHODS = {
  card: 'card',
  mia: 'MAIB_MIA_QR',
} as const;

export const SUPPORTED_LANGUAGES = ['en', 'ro', 'ru'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
