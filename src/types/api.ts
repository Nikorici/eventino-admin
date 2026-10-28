import type { EventSeatMapSummary, TicketSeat } from './seating';

export type EventType = 'PUBLIC' | 'PRIVATE' | 'PERSONAL';

export interface Follower {
  id: number;
  profile_image: string | null;
  organization_name: string | null;
  first_name: string;
  last_name: string;
}

export interface Coordinates {
  lat: string | number;
  long: string | number;
}

export interface Category {
  id: number;
  name: string;
}

export interface TicketType {
  id: number;
  name: string;
  price: string | number;
  currency?: string;
  currency_code?: string;
  quantity?: number | null;
  available_quantity?: number;
  qr_code_quantity?: number;
  show_remaining_tickets?: boolean;
  sale_start_date?: string | null;
  sale_end_date?: string | null;
  is_active?: boolean;
  is_archived?: boolean;
  is_table?: boolean;
  comment?: string;
  event_day?: string | null;
}

export interface EventImage {
  id?: number;
  image: string;
  order: number;
}

export interface EventListItem {
  id: number;
  title: string;
  slug: string;
  start_date: string;
  start_time: string;
  end_date: string | null;
  end_time: string | null;
  images: string[];
  followers: Follower[];
  type: EventType;
  in_draft: boolean;
  country: string;
  region: string;
  address: string;
  location_is_tba: boolean;
  time_is_tba?: boolean;
  event_location_type: string;
  coordinates?: Coordinates;
  owner_id: number;
  owner_icon?: string | null;
  is_subscribed?: boolean;
  currency?: string | null;
  categories: (string | Category)[];
  ticket_types: TicketType[];
  created_at?: string | null;
}

export interface Organizer {
  id: number;
  first_name: string;
  last_name: string;
  organization_name: string | null;
  profile_image: string | null;
  followers?: number[];
  followers_count?: number;
  invite_accepted?: boolean;
  is_full_confirmation?: boolean;
  tva_percent?: number;
  tva_included_in_ticket_price?: boolean;
}

export interface JoinedPerson {
  id: number;
  first_name: string;
  last_name: string;
  profile_image: string | null;
  organization_name: string | null;
}

export type QuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'email'
  | 'phone_number'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown';

export interface EventQuestion {
  id: number;
  question: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

export interface EventCoupon {
  id: number;
  code: string;
  discount: number;
  max_uses: number;
  usage_count: number;
  is_active: boolean;
}

export interface ArenaZone {
  id: number | null;
  zone_id: number;
  name: string;
  template_slot_id: string;
  color: string;
  capacity: number;
  tickets_sold: number;
  available_capacity: number;
  is_full: boolean;
  is_active: boolean;
  comment: string;
  ticket_type_id: number | null;
  ticket_type_name: string | null;
  ticket_price: string | null;
}

export interface ArenaVenue {
  id: number;
  venue_id: number;
  name: string;
  location: string;
  capacity: number;
  template: string;
  configuration_notes: string | null;
  zones: ArenaZone[];
}

export interface EventStaffPermissions {
  permission: string;
  can_view_buyers: boolean;
  can_view_analytics: boolean;
  can_manage_tickets: boolean;
  can_manage_orders: boolean;
  can_manage_forms: boolean;
  can_manage_scanners: boolean;
}

export interface EventDelegatePermissions {
  can_edit: boolean;
  can_post: boolean;
  can_delete: boolean;
}

export interface EventDetail extends Omit<EventListItem, 'categories'> {
  description: string;
  status?: string;
  language?: string;
  event_images?: EventImage[];
  video?: string | null;
  video_order?: number;
  owner?: Organizer;
  organizers?: Organizer[];
  categories: (string | Category)[];
  joined_people?: JoinedPerson[];
  joined_people_max_count?: number;
  questions_data?: EventQuestion[];
  coupons?: EventCoupon[];
  venues?: ArenaVenue[];
  is_sold_out?: boolean;
  is_featured?: boolean;
  platform_fee_percent?: number;
  commission_vat_percent?: number;
  commission_paid_by?: string;
  max_tickets_per_user?: number;
  additional_information?: string;
  seat_map?: EventSeatMapSummary | null;
  has_presale?: boolean;
  attendee_info_fields?: string[];
  free_ticket_approval_enabled?: boolean;
  checkin_required?: boolean;
  wallet_topup_enabled?: boolean;
  allow_self_service_refunds?: boolean;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  is_staff_member?: boolean;
  staff_permissions?: EventStaffPermissions | null;
  is_account_delegate?: boolean;
  delegate_permissions?: EventDelegatePermissions | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CategoryGroup {
  category_name: string;
  category_slug: string;
  events: EventListItem[];
}

export interface FollowUser {
  id: number;
  first_name: string;
  last_name: string;
  organization_name: string | null;
  profile_image: string | null;
  is_organization?: boolean;
  is_full_confirmation?: boolean;
  badge_type?: string;
}

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string | null;
  is_organization?: boolean;
  short_description?: string;
  city?: string;
  country?: string;
  phone_number?: string;
  profile_image?: string | null;
  is_full_confirmation?: boolean;
  is_email_confirmed?: boolean;
  is_phone_number_confirmed?: boolean;
  is_staff?: boolean;
  badge_type?: string;
  events_created_count?: number;
  joined_events_count?: number;
  followers_count?: number;
  following?: FollowUser[];
  followers?: FollowUser[];
  created_events?: EventListItem[];
  joined_events?: EventListItem[];
  registration_method?: string;
  scheduledDeletionDate?: string | null;
  send_mail_permission?: boolean;
}

export interface TicketEventRef {
  id: number;
  slug: string;
  title?: string;
  time_is_tba?: boolean;
  address?: string;
  region?: string;
  city?: string;
  country: string;
  currency?: string;
  start_date: string;
  start_time: string;
  event_images?: EventImage[];
  owner?: { tva_percent?: number; tva_included_in_ticket_price?: boolean };
  commission_paid_by?: string;
  platform_fee_percent?: number;
  commission_vat_percent?: number;
}

export interface Ticket {
  id: number;
  uuid: string;
  participant_info?: { scannable_id?: string } | null;
  ticket_type: {
    id: number;
    name: string;
    price?: number;
    event?: TicketEventRef;
    event_day?: string | null;
    event_day_number?: number | null;
  };
  event_zone?: { zone_details?: { name: string } } | null;
  seat?: TicketSeat | null;
  scan_date?: string | null;
}

export interface TicketOrder {
  id: number;
  payment_status: string;
  payment_method: string;
  order_date?: string | null;
  tickets: Ticket[];
  total_price: number | string;
  vat_included?: boolean;
  vat_amount?: number;
  total_price_without_vat?: number | string;
  total_price_with_vat?: number | string;
}

export interface Coupon {
  id: number;
  code: string;
  discount: number;
  ticket_types: number[];
}

export type RefundRequestStatus = 'PROCESSING' | 'REFUNDED' | 'FAILED';

export interface RefundRequestState {
  status: RefundRequestStatus;
  amount: string;
  currency: string;
}

export interface RefundEligibilityTicket {
  id: number;
  ticket_type: string;
  price: string;
  event_title: string;
}

export interface RefundEligibility {
  order_id: number;
  eligible: boolean;
  reason: string;
  amount: string;
  currency: string;
  payment_status: string;
  tickets: RefundEligibilityTicket[];
  refund_request: RefundRequestState | null;
}

export interface CreateOrderTicket {
  ticket_type_id: number;
  quantity: number;
  zone_id?: number | null;
  participants_info?: Record<string, string>[] | null;
  seat_ids?: number[];
}

export interface CreateOrderBody {
  tickets: CreateOrderTicket[];
  seat_hold_token?: string;
  coupon?: string;
  invoice_after_payment?: boolean;
  factura_after_payment?: boolean;
  factura_individual_after_payment?: boolean;
  invoice_first_name?: string;
  invoice_last_name?: string;
  payment_method?: string;
  redirect_url?: string;
  native_return?: boolean;
  offer_token?: string;
}

export interface CreateOrderResponse {
  order_id: number;
  order_token: string;
  checkout_url: string | null;
  payment_method: string;
  payment_status: string;
  pending_approval?: boolean;
  invoice_requested?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SendOtpResponse {
  status?: number;
  user_exists?: boolean;
  message?: string;
}

export interface VerifyOtpResponse {
  status?: number;
  access?: string;
  refresh?: string;
  user?: User;
  is_new_account?: boolean;
  message?: string;
  data?: VerifyOtpResponse;
}

export interface DiscoverFilters {
  search: string;
  category: number[];
  country: string;
  region: string;
  type: '' | 'PUBLIC' | 'PERSONAL';
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
}
