export type SeatStatus = 'available' | 'sold' | 'reserved' | 'blocked' | 'disabled' | 'unavailable';
export type SeatRenderStatus = SeatStatus | 'selected';
export type LayoutStatus = 'draft' | 'active' | 'archived';
export type SeatMapStatus = 'draft' | 'active';
export type HoldStatus = 'active' | 'converted' | 'released' | 'expired';
export type LabelAnchor = 'start' | 'middle';
export type RowLabelMode = 'ends' | 'fixed' | 'none';
export type CanvasPoint = [number, number];
export type LocalizedText = Record<string, string>;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface LayoutVenue {
  id: number;
  name: string;
  location: string;
}

export interface StageElement {
  type: 'stage';
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  label?: string | null;
  label_i18n?: LocalizedText | null;
}

export interface LabelElement {
  type: 'label';
  key: string;
  x: number;
  y: number;
  text: string;
  text_i18n?: LocalizedText | null;
  font_size?: number;
  rotation?: number;
  anchor?: LabelAnchor;
}

export interface ShapeElement {
  type: 'shape';
  key: string;
  points: CanvasPoint[];
  fill?: string | null;
  stroke?: string | null;
  label?: string | null;
}

export type LayoutElement = StageElement | LabelElement | ShapeElement;

export interface LayoutSeat {
  id: number;
  label: string;
  x: number;
  y: number;
  is_accessible: boolean;
  is_default_blocked: boolean;
}

export interface LayoutRow {
  id: number;
  label: string;
  display_order: number;
  seats: LayoutSeat[];
}

export interface SectionLabel {
  x: number;
  y: number;
  rotation: number;
  anchor: LabelAnchor;
}

export interface RowLabels {
  mode: RowLabelMode;
  x: [number, number] | null;
}

export interface LayoutSection {
  id: number;
  key: string;
  name: string;
  name_i18n: LocalizedText | null;
  color: string;
  display_order: number;
  label: SectionLabel | null;
  outline: CanvasPoint[];
  row_labels: RowLabels;
  rows: LayoutRow[];
}

export interface VenueLayoutDetail {
  id: number;
  name: string;
  slug: string;
  status: LayoutStatus;
  venue: LayoutVenue;
  canvas: CanvasSize;
  seat_radius: number;
  elements: LayoutElement[];
  sections: LayoutSection[];
}

export interface SeatMapInfo {
  id: number;
  status: SeatMapStatus;
  config_version: number;
  hold_ttl_seconds: number;
  max_seats_per_order: number;
  currency: string;
  available_seats: number;
  server_time: string;
}

export interface SeatMapSectionConfig {
  section_id: number;
  ticket_type_id: number | null;
  is_active: boolean;
}

export interface SeatCategory {
  ticket_type_id: number;
  name: string;
  price: string;
  color: string;
}

export interface SeatStatusBuckets {
  sold: number[];
  reserved: number[];
  blocked: number[];
  disabled: number[];
  unavailable: number[];
}

export interface HoldSeat {
  seat_id: number;
  section_id: number;
  section_key: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  ticket_type_id: number | null;
  ticket_type_name: string | null;
  price: string | null;
}

export interface PricedHoldSeat extends HoldSeat {
  ticket_type_id: number;
  ticket_type_name: string;
  price: string;
}

export interface SeatHoldPayload {
  hold_token: string;
  status: HoldStatus;
  expires_at: string;
  max_expires_at: string;
  server_time: string;
  seats: HoldSeat[];
  total: string;
  currency: string;
  order_id: number | null;
}

export interface EventSeatMapResponse {
  seat_map: SeatMapInfo;
  layout: VenueLayoutDetail;
  sections: SeatMapSectionConfig[];
  seat_categories: Record<string, number>;
  categories: SeatCategory[];
  statuses: SeatStatusBuckets;
  my_hold: SeatHoldPayload | null;
}

export interface SeatStatusResponse {
  server_time: string;
  config_version: number;
  available_seats: number;
  statuses: SeatStatusBuckets;
}

export interface HoldSeatsBody {
  seat_ids: number[];
  hold_token?: string;
}

export interface ValidateHoldResponse extends SeatHoldPayload {
  valid: true;
}

export type ValidateHoldFailureCode = 'hold_expired' | 'seats_unavailable' | 'hold_converted';

export interface ValidateHoldFailure {
  valid: false;
  code: ValidateHoldFailureCode;
  unavailable_seat_ids?: number[];
}

export type SeatingErrorCode =
  | 'max_seats'
  | 'invalid_seat'
  | 'seat_map_inactive'
  | 'hold_mismatch'
  | 'seats_unavailable'
  | 'too_many_holds'
  | 'hold_not_found'
  | 'hold_expired'
  | 'hold_converted'
  | 'no_seat_map'
  | 'stream_unavailable'
  | 'seat_hold_required'
  | 'seat_quantity_mismatch'
  | 'seat_line_mismatch'
  | 'seat_zone_not_allowed'
  | 'seats_offer_unsupported'
  | 'qr_quantity'
  | 'payment_init_failed';

export interface SeatingErrorBody {
  detail?: string;
  message?: string;
  code?: string;
  valid?: boolean;
  unavailable_seat_ids?: number[];
}

export interface SeatStatusChange {
  seat_id: number;
  status: SeatStatus;
}

export interface SeatStatusEvent {
  type: 'SEAT_STATUS';
  dedupe_id: string;
  event_id: number;
  server_time: string;
  changes: SeatStatusChange[];
}

export interface SeatMapConfigEvent {
  type: 'SEAT_MAP_CONFIG';
  dedupe_id: string;
  event_id: number;
  config_version: number;
}

export type SeatMapStreamEvent = SeatStatusEvent | SeatMapConfigEvent;

export interface EventSeatMapSummary {
  id: number;
  status: SeatMapStatus;
  layout_id: number;
  layout_name: string;
  venue_name: string;
  hold_ttl_seconds: number;
  max_seats_per_order: number;
  seat_count: number;
  available_seats: number;
  price_min: string | null;
  price_max: string | null;
}

export interface TicketSeat {
  seat_id: number;
  section_name: string;
  row_label: string;
  seat_label: string;
}

export interface VenueLayoutListItem {
  id: number;
  name: string;
  slug: string;
  status: LayoutStatus;
  venue: LayoutVenue;
  canvas: CanvasSize;
  seat_count: number;
  section_count: number;
}

export interface SeatMapConfigSection {
  section_id: number;
  key: string;
  name: string;
  seat_count: number;
  ticket_type_id: number | null;
  is_active: boolean;
}

export interface SeatCategoryRule {
  id: number;
  row_id: number | null;
  seat_id: number | null;
  ticket_type_id: number;
}

export type SeatBlockStatus = 'blocked' | 'disabled' | 'unavailable';

export interface SeatBlock {
  seat_id: number;
  status: SeatBlockStatus;
  note: string;
}

export interface SeatMapConfigTicketType {
  id: number;
  name: string;
  price: string;
  qr_code_quantity: number;
  is_active: boolean;
}

export interface SeatMapConfigInfo {
  id: number;
  status: SeatMapStatus;
  layout_id: number;
  hold_ttl_seconds: number;
  hold_max_lifetime_seconds: number;
  payment_ttl_seconds: number;
  deferred_payment_ttl_seconds: number;
  max_seats_per_order: number;
  max_active_holds_per_identity: number;
  category_colors: Record<string, string>;
  config_version: number;
}

export interface SeatMapConfigStatuses {
  sold: number[];
  reserved: number[];
}

export interface SeatMapConfigResponse {
  seat_map: SeatMapConfigInfo | null;
  layout: VenueLayoutDetail | null;
  sections: SeatMapConfigSection[];
  category_rules: SeatCategoryRule[];
  blocks: SeatBlock[];
  statuses: SeatMapConfigStatuses;
  ticket_types: SeatMapConfigTicketType[];
  layouts: VenueLayoutListItem[];
}

export interface SeatMapConfigPayload {
  layout_id?: number;
  status?: SeatMapStatus;
  hold_ttl_seconds?: number;
  max_seats_per_order?: number;
  category_colors?: Record<string, string>;
  sections?: { section_id: number; ticket_type_id: number | null; is_active: boolean }[];
  category_rules?: { row_id?: number; seat_id?: number; ticket_type_id: number }[];
  blocks?: { seat_id: number; status: SeatBlockStatus; note?: string }[];
}
