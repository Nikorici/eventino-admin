import {
  Activity,
  Armchair,
  BarChart3,
  Building2,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  CreditCard,
  Link2,
  Megaphone,
  Printer,
  ScanLine,
  Settings,
  ShoppingBag,
  SquarePen,
  Tag,
  Ticket,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import type { EventDetail, User as AppUser } from '@/types/api';

import type { RouteKey } from './nav';

export type TabKey = 'dashboard' | 'sales' | 'analytics' | 'manage' | 'more';

export interface EventPermissions {
  isEventOwner: boolean;
  isStaffMember: boolean;
  isAccountDelegate: boolean;
  isSystemStaff: boolean;
  canManageEvent: boolean;
  hasFullAccess: boolean;
  canDeleteEvent: boolean;
  canViewBuyers: boolean;
  canViewAnalytics: boolean;
  canManageTickets: boolean;
  canManageOrders: boolean;
  canManageForms: boolean;
  canManageScanners: boolean;
  hasOrdersAccess: boolean;
  canManageLabelPrinting: boolean;
}

export function eventPermissions(event: EventDetail | null | undefined, user: AppUser | null | undefined): EventPermissions {
  const isEventOwner = Boolean(user && event?.owner?.id === user.id);
  const isStaffMember = Boolean(event?.is_staff_member);
  const staffPerms = event?.staff_permissions ?? null;
  const isAccountDelegate = Boolean(event?.is_account_delegate);
  const delegatePerms = event?.delegate_permissions ?? null;
  const isSystemStaff = Boolean(user?.is_staff);
  const canManageEvent = isEventOwner || isSystemStaff || isStaffMember || isAccountDelegate;
  const hasFullAccess = isEventOwner || isSystemStaff || staffPerms?.permission === 'full' || Boolean(delegatePerms?.can_edit);
  const canViewBuyers = hasFullAccess || Boolean(staffPerms?.can_view_buyers);
  const canManageOrders = hasFullAccess || Boolean(staffPerms?.can_manage_orders);
  return {
    isEventOwner,
    isStaffMember,
    isAccountDelegate,
    isSystemStaff,
    canManageEvent,
    hasFullAccess,
    canDeleteEvent: isEventOwner || isSystemStaff || Boolean(delegatePerms?.can_delete),
    canViewBuyers,
    canViewAnalytics: hasFullAccess || Boolean(staffPerms?.can_view_analytics),
    canManageTickets: hasFullAccess || Boolean(staffPerms?.can_manage_tickets),
    canManageOrders,
    canManageForms: hasFullAccess || Boolean(staffPerms?.can_manage_forms),
    canManageScanners: hasFullAccess || Boolean(staffPerms?.can_manage_scanners),
    hasOrdersAccess: canViewBuyers || canManageOrders,
    canManageLabelPrinting:
      isEventOwner || isSystemStaff || staffPerms?.permission === 'full' || Boolean(staffPerms?.can_manage_tickets),
  };
}

export interface SectionAccess {
  isSystemStaff: boolean;
  hasStickerAccess: boolean;
  eventLoaded: boolean;
  hasPresale: boolean;
  permissions: EventPermissions;
}

export function sectionAccess(input: {
  user: AppUser | null | undefined;
  event: EventDetail | null | undefined;
  hasStickerAccess: boolean;
}): SectionAccess {
  return {
    isSystemStaff: Boolean(input.user?.is_staff),
    hasStickerAccess: input.hasStickerAccess,
    eventLoaded: Boolean(input.event),
    hasPresale: Boolean(input.event?.has_presale),
    permissions: eventPermissions(input.event, input.user),
  };
}

export interface SectionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  route: RouteKey;
  ticket: string;
  webPath: string;
  visible: (access: SectionAccess) => boolean;
}

export interface SectionGroup {
  key: string;
  title?: string;
  tab: TabKey;
  eventScoped: boolean;
  items: SectionItem[];
}

const always = () => true;
const eventGate = (check: (permissions: EventPermissions, access: SectionAccess) => boolean) => (access: SectionAccess) =>
  access.eventLoaded && check(access.permissions, access);
const fullAccess = eventGate((permissions) => permissions.hasFullAccess);

export const sections: SectionGroup[] = [
  {
    key: 'event-tickets-group',
    title: 'Sales & Scanning',
    tab: 'sales',
    eventScoped: true,
    items: [
      {
        key: 'event-ticket-scanners',
        label: 'Ticket Scanners',
        icon: ScanLine,
        route: 'ticketScanners',
        ticket: 'EA-7',
        webPath: '/dashboard/events/[id]/ticket-scanners',
        visible: eventGate((permissions) => permissions.canManageScanners),
      },
      {
        key: 'event-label-printing',
        label: 'Label Printing',
        icon: Printer,
        route: 'labelPrinting',
        ticket: 'EA-8',
        webPath: '/dashboard/events/[id]/label-printing',
        visible: eventGate((permissions) => permissions.canManageLabelPrinting),
      },
      {
        key: 'event-ticket-type-sales',
        label: 'Ticket Type Sales',
        icon: Ticket,
        route: 'ticketTypeSales',
        ticket: 'EA-9',
        webPath: '/dashboard/events/[id]/ticket-type-sales',
        visible: fullAccess,
      },
      {
        key: 'event-ticket-info',
        label: 'Ticket Purchase Info',
        icon: Ticket,
        route: 'ticketInfo',
        ticket: 'EA-10',
        webPath: '/dashboard/events/[id]/ticket-info',
        visible: eventGate((permissions) => permissions.canViewAnalytics),
      },
      {
        key: 'event-presale',
        label: 'Pre-sale',
        icon: UserPlus,
        route: 'presale',
        ticket: 'EA-11',
        webPath: '/dashboard/events/[id]/presale',
        visible: eventGate((permissions, access) => permissions.canViewBuyers && access.hasPresale),
      },
      {
        key: 'event-ticket-scan-stats',
        label: 'Ticket Scan Statistics',
        icon: BarChart3,
        route: 'scanStatistics',
        ticket: 'EA-12',
        webPath: '/dashboard/events/[id]/ticket-scan-statistics',
        visible: fullAccess,
      },
      {
        key: 'event-merch-store',
        label: 'Merch Store',
        icon: ShoppingBag,
        route: 'merch',
        ticket: 'EA-13',
        webPath: '/dashboard/events/[id]/merch',
        visible: fullAccess,
      },
    ],
  },
  {
    key: 'event-analytics-group',
    title: 'Analytics',
    tab: 'analytics',
    eventScoped: true,
    items: [
      {
        key: 'event-traffic-sources',
        label: 'Traffic Sources',
        icon: Activity,
        route: 'trafficSources',
        ticket: 'EA-14',
        webPath: '/dashboard/events/[id]/traffic-sources',
        visible: fullAccess,
      },
      {
        key: 'event-referral-tracking',
        label: 'Referral Tracking',
        icon: Link2,
        route: 'referralTracking',
        ticket: 'EA-15',
        webPath: '/dashboard/events/[id]/referral-tracking',
        visible: fullAccess,
      },
      {
        key: 'event-marketing-tracking',
        label: 'Marketing & Tracking',
        icon: Megaphone,
        route: 'marketingTracking',
        ticket: 'EA-16',
        webPath: '/dashboard/events/[id]/marketing-tracking',
        visible: fullAccess,
      },
    ],
  },
  {
    key: 'event-edit-group',
    title: 'Event',
    tab: 'manage',
    eventScoped: true,
    items: [
      {
        key: 'event-edit',
        label: 'Edit event',
        icon: SquarePen,
        route: 'editEvent',
        ticket: 'EA-6',
        webPath: '/create-event?isEdit=true&event_id=[id]',
        visible: fullAccess,
      },
    ],
  },
  {
    key: 'event-management-group',
    title: 'Management',
    tab: 'manage',
    eventScoped: true,
    items: [
      {
        key: 'event-form-management',
        label: 'Form Management',
        icon: ClipboardList,
        route: 'formManagement',
        ticket: 'EA-17',
        webPath: '/dashboard/events/[id]/form-management',
        visible: fullAccess,
      },
      {
        key: 'event-staff',
        label: 'Event Staff',
        icon: Users,
        route: 'staff',
        ticket: 'EA-18',
        webPath: '/dashboard/events/[id]/event-staff',
        visible: fullAccess,
      },
      {
        key: 'event-venue-pricing',
        label: 'Venue & Pricing',
        icon: Building2,
        route: 'venuePricing',
        ticket: 'EA-19',
        webPath: '/dashboard/events/[id]/venue-pricing',
        visible: fullAccess,
      },
      {
        key: 'event-ticket-types',
        label: 'Ticket types',
        icon: Ticket,
        route: 'ticketTypes',
        ticket: 'EA-20',
        webPath: '/dashboard/events/[id]/ticket-types',
        visible: fullAccess,
      },
      {
        key: 'event-vouchers',
        label: 'Vouchers',
        icon: Tag,
        route: 'vouchers',
        ticket: 'EA-21',
        webPath: '/dashboard/events/[id]/vouchers',
        visible: fullAccess,
      },
      {
        key: 'event-private-offers',
        label: 'Private offers',
        icon: CreditCard,
        route: 'privateOffers',
        ticket: 'EA-22',
        webPath: '/dashboard/events/[id]/private-offers',
        visible: fullAccess,
      },
      {
        key: 'event-tables',
        label: 'Tables',
        icon: Armchair,
        route: 'tables',
        ticket: 'EA-23',
        webPath: '/dashboard/events/[id]/tables',
        visible: fullAccess,
      },
      {
        key: 'event-ticket-sales-invoices',
        label: 'Ticket sales invoices',
        icon: ClipboardList,
        route: 'invoices',
        ticket: 'EA-24',
        webPath: '/dashboard/events/[id]/ticket-sales-invoices',
        visible: fullAccess,
      },
    ],
  },
  {
    key: 'overview-group',
    tab: 'more',
    eventScoped: false,
    items: [
      {
        key: 'overview',
        label: 'Overview',
        icon: ChartNoAxesColumnIncreasing,
        route: 'overview',
        ticket: 'EA-25',
        webPath: '/dashboard',
        visible: always,
      },
    ],
  },
  {
    key: 'events-group',
    title: 'Events',
    tab: 'more',
    eventScoped: false,
    items: [
      {
        key: 'event-list',
        label: 'List of Events',
        icon: Ticket,
        route: 'selectEvent',
        ticket: 'EA-4',
        webPath: '/dashboard/events',
        visible: always,
      },
      {
        key: 'admin-events',
        label: 'Admin Events',
        icon: Ticket,
        route: 'adminEvents',
        ticket: 'EA-26',
        webPath: '/dashboard/admin-events',
        visible: (access) => access.isSystemStaff,
      },
    ],
  },
  {
    key: 'tickets-group',
    title: 'Tickets',
    tab: 'more',
    eventScoped: false,
    items: [
      {
        key: 'fiscalizare',
        label: 'Fiscalizare Bilete',
        icon: Ticket,
        route: 'fiscalizare',
        ticket: 'EA-27',
        webPath: '/dashboard/fiscalizare-bilete',
        visible: always,
      },
      {
        key: 'label-printers',
        label: 'Label Printers',
        icon: Printer,
        route: 'labelPrinters',
        ticket: 'EA-28',
        webPath: '/dashboard/label-printers',
        visible: always,
      },
      {
        key: 'stickers',
        label: 'Stickers',
        icon: Tag,
        route: 'stickers',
        ticket: 'EA-29',
        webPath: '/dashboard/stickers',
        visible: (access) => access.hasStickerAccess || access.isSystemStaff,
      },
    ],
  },
  {
    key: 'tools-group',
    title: 'Tools',
    tab: 'more',
    eventScoped: false,
    items: [
      {
        key: 'smartbill',
        label: 'SmartBill Integration',
        icon: ClipboardList,
        route: 'smartbill',
        ticket: 'EA-30',
        webPath: '/dashboard/smartbill',
        visible: always,
      },
      {
        key: 'team',
        label: 'My Team',
        icon: Users,
        route: 'team',
        ticket: 'EA-31',
        webPath: '/dashboard/team',
        visible: always,
      },
      {
        key: 'traffic-sources',
        label: 'Profile Traffic',
        icon: Activity,
        route: 'profileTraffic',
        ticket: 'EA-32',
        webPath: '/dashboard/traffic-sources',
        visible: always,
      },
      {
        key: 'message-subscribers',
        label: 'Message Subscribers',
        icon: User,
        route: 'messageSubscribers',
        ticket: 'EA-33',
        webPath: '/dashboard/message-subscribers',
        visible: always,
      },
    ],
  },
  {
    key: 'account-group',
    title: 'Account',
    tab: 'more',
    eventScoped: false,
    items: [
      {
        key: 'company-info',
        label: 'Company Information',
        icon: Building2,
        route: 'companyInfo',
        ticket: 'EA-34',
        webPath: '/dashboard/company-info',
        visible: always,
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: Settings,
        route: 'settings',
        ticket: 'EA-35',
        webPath: '/settings',
        visible: always,
      },
    ],
  },
];

export function visibleSections(tab: TabKey, access: SectionAccess): SectionGroup[] {
  return sections
    .filter((group) => group.tab === tab)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible(access)) }))
    .filter((group) => group.items.length > 0);
}

export function findSectionItem(route: RouteKey): SectionItem | undefined {
  for (const group of sections) {
    const item = group.items.find((candidate) => candidate.route === route);
    if (item) return item;
  }
  return undefined;
}
