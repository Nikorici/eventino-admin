import type { Coordinates, EventType, QuantityDiscountTier } from '@/types/api';

export interface MultipartFile {
  uri: string;
  name: string;
  type: string;
}

interface NativeFormData {
  append(name: string, value: string | MultipartFile): void;
}

const NativeFormDataCtor: { new (): NativeFormData } = FormData;

export type EventLocationType = 'physical' | 'virtual';

export interface EventTicketTypeInput {
  id?: number;
  name: string;
  price: number;
  quantity: number | null;
  comment: string;
  currency: string;
  sale_start_date: string | null;
  sale_end_date: string | null;
  is_active: boolean;
  qr_code_quantity: number;
  show_remaining_tickets: boolean;
  is_table: boolean;
  event_day: string | null;
  quantity_discounts?: QuantityDiscountTier[] | null;
}

export interface EventCouponInput {
  id: number | null;
  code: string;
  discount: number;
  max_uses: number;
  is_active: boolean;
}

export interface EventQuestionInput {
  id?: number | string;
  question: string;
  description: string;
  type: string;
  options: string[];
  conditions: unknown[];
  required: boolean;
  order: number;
}

export interface EventOrganizerInput {
  id: number;
  invite_accepted: 'pending';
}

export interface EventTimelineInput {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

export interface EventScalarInput {
  title: string;
  description: string;
  category: number;
  type: EventType;
  currency: string;
  in_draft: boolean;
  start_date: string;
  start_time: string;
  end_date?: string;
  end_time?: string;
  time_is_tba?: boolean;
  event_location_type: EventLocationType;
  location_is_tba: boolean;
  country: string;
  region: string;
  address: string;
  coordinates?: Coordinates;
  ticket_types: EventTicketTypeInput[];
  questions: EventQuestionInput[];
  organizers: EventOrganizerInput[];
  timelines: EventTimelineInput[];
}

export interface CreateEventInput extends EventScalarInput {
  owner: number;
  company?: number;
  coupons: EventCouponInput[];
  photos: MultipartFile[];
  video?: MultipartFile;
}

export type EventMediaOrderEntry =
  | { type: 'image'; existing_image_id: number }
  | { type: 'image'; photo_index: number }
  | { type: 'video' };

export interface UpdateEventInput extends EventScalarInput {
  id: number;
  company?: number;
  newPhotos: MultipartFile[];
  existingImageIds: number[];
  mediaOrder: EventMediaOrderEntry[];
  coupons?: EventCouponInput[];
  video?: MultipartFile;
  removeVideo: boolean;
}

function appendEventScalars(form: NativeFormData, input: EventScalarInput, includeEmptyTimelines: boolean): void {
  form.append('title', input.title);
  form.append('description', input.description);
  form.append('category', String(input.category));
  form.append('start_date', input.start_date);
  form.append('start_time', input.start_time);
  if (input.end_date) form.append('end_date', input.end_date);
  if (input.end_time) form.append('end_time', input.end_time);
  form.append('time_is_tba', input.time_is_tba ? 'true' : 'false');
  form.append('currency', input.currency);
  form.append('type', input.type);
  form.append('in_draft', input.in_draft ? 'true' : 'false');
  form.append('event_location_type', input.event_location_type);
  form.append('location_is_tba', input.location_is_tba ? 'true' : 'false');
  form.append('country', input.country);
  form.append('region', input.region);
  form.append('address', input.address);
  form.append('coordinates', JSON.stringify(input.coordinates ?? { lat: 0, long: 0 }));
  form.append('ticket_types', JSON.stringify(input.ticket_types));
  form.append('questions', JSON.stringify(input.questions));
  form.append('organizers', JSON.stringify(input.organizers));
  if (includeEmptyTimelines || input.timelines.length > 0) form.append('timelines', JSON.stringify(input.timelines));
}

export function buildCreateEventBody(input: CreateEventInput): NativeFormData {
  const form = new NativeFormDataCtor();
  form.append('owner', String(input.owner));
  if (input.company != null) form.append('company', String(input.company));
  appendEventScalars(form, input, false);
  form.append('coupons', JSON.stringify(input.coupons));
  input.photos.forEach((photo) => form.append('photos', photo));
  if (input.video) form.append('video', input.video);
  return form;
}

export function buildUpdateEventBody(input: UpdateEventInput): NativeFormData {
  const form = new NativeFormDataCtor();
  appendEventScalars(form, input, true);
  if (input.company != null) form.append('company', String(input.company));
  if (input.coupons) form.append('coupons', JSON.stringify(input.coupons));
  form.append('replace_images', 'true');
  form.append('existing_image_ids', JSON.stringify(input.existingImageIds));
  input.newPhotos.forEach((photo) => form.append('photos', photo));
  if (input.video) form.append('video', input.video);
  else if (input.removeVideo) form.append('video', '');
  if (input.mediaOrder.length > 0) form.append('media_order', JSON.stringify(input.mediaOrder));
  return form;
}
