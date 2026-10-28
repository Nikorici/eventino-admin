import { router, type Href } from 'expo-router';

export function href(pathname: string, params?: Record<string, string>): Href {
  return (params ? { pathname, params } : pathname) as unknown as Href;
}

export const routes = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  selectEvent: '/select-event',
  createEvent: '/create-event',

  dashboard: '/dashboard',

  sales: '/sales',
  ticketScanners: '/sales/ticket-scanners',
  labelPrinting: '/sales/label-printing',
  ticketTypeSales: '/sales/ticket-type-sales',
  ticketInfo: '/sales/ticket-info',
  presale: '/sales/presale',
  scanStatistics: '/sales/scan-statistics',
  merch: '/sales/merch',

  analytics: '/analytics',
  trafficSources: '/analytics/traffic-sources',
  referralTracking: '/analytics/referral-tracking',
  marketingTracking: '/analytics/marketing-tracking',

  manage: '/manage',
  editEvent: '/manage/edit-event',
  formManagement: '/manage/form-management',
  staff: '/manage/staff',
  venuePricing: '/manage/venue-pricing',
  ticketTypes: '/manage/ticket-types',
  vouchers: '/manage/vouchers',
  privateOffers: '/manage/private-offers',
  tables: '/manage/tables',
  invoices: '/manage/invoices',

  more: '/more',
  overview: '/more/overview',
  adminEvents: '/more/admin-events',
  fiscalizare: '/more/fiscalizare',
  labelPrinters: '/more/label-printers',
  stickers: '/more/stickers',
  smartbill: '/more/smartbill',
  team: '/more/team',
  profileTraffic: '/more/profile-traffic',
  messageSubscribers: '/more/message-subscribers',
  companyInfo: '/more/company-info',
  settings: '/more/settings',
} as const;

export type RouteKey = keyof typeof routes;

const push = (key: RouteKey) => () => router.push(href(routes[key]));

export const navigate = {
  to: (key: RouteKey) => router.push(href(routes[key])),
  replace: (key: RouteKey) => router.replace(href(routes[key])),
  dismissTo: (key: RouteKey) => router.dismissTo(href(routes[key])),
  home: () => router.replace(href('/')),
  back: () => (router.canGoBack() ? router.back() : router.replace(href('/'))),
  canGoBack: () => router.canGoBack(),

  login: push('login'),
  register: push('register'),
  forgotPassword: push('forgotPassword'),
  selectEvent: push('selectEvent'),
  createEvent: push('createEvent'),

  dashboard: () => router.replace(href(routes.dashboard)),

  sales: push('sales'),
  ticketScanners: push('ticketScanners'),
  labelPrinting: push('labelPrinting'),
  ticketTypeSales: push('ticketTypeSales'),
  ticketInfo: push('ticketInfo'),
  presale: push('presale'),
  scanStatistics: push('scanStatistics'),
  merch: push('merch'),

  analytics: push('analytics'),
  trafficSources: push('trafficSources'),
  referralTracking: push('referralTracking'),
  marketingTracking: push('marketingTracking'),

  manage: push('manage'),
  editEvent: push('editEvent'),
  formManagement: push('formManagement'),
  staff: push('staff'),
  venuePricing: push('venuePricing'),
  ticketTypes: push('ticketTypes'),
  vouchers: push('vouchers'),
  privateOffers: push('privateOffers'),
  tables: push('tables'),
  invoices: push('invoices'),

  more: push('more'),
  overview: push('overview'),
  adminEvents: push('adminEvents'),
  fiscalizare: push('fiscalizare'),
  labelPrinters: push('labelPrinters'),
  stickers: push('stickers'),
  smartbill: push('smartbill'),
  team: push('team'),
  profileTraffic: push('profileTraffic'),
  messageSubscribers: push('messageSubscribers'),
  companyInfo: push('companyInfo'),
  settings: push('settings'),
};
