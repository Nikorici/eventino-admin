import { eventCurrencyCode } from '@/lib/format';
import type { Category, EventCoupon, EventDetail } from '@/types/api';
import { createTimelineItemId, type EventFormTimelineItem } from '@/components/events/TimelineEditor';
import type { SelectedOrganizer } from '@/components/events/OrganizerPicker';

import type { EventFormCoupon, EventFormInitialValues, EventFormMediaItem } from './EventForm';
import { parseQuestionConditions, type EventFormQuestion } from './QuestionsBuilder';

function resolveCategoryId(event: EventDetail, categories?: Category[]): number | null {
  const asObject = (event.categories ?? []).find((c): c is Category => typeof c === 'object' && c !== null);
  if (asObject) return asObject.id;
  const asName = (event.categories ?? []).find((c): c is string => typeof c === 'string');
  if (asName && categories) return categories.find((c) => c.name === asName)?.id ?? null;
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readCoordinates(event: EventDetail): { lat: number; long: number } | null {
  const coords = event.coordinates;
  if (!coords) return null;
  const lat = Number(coords.lat);
  const long = Number(coords.long);
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
  return { lat, long };
}

function buildMediaItems(event: EventDetail): EventFormMediaItem[] {
  const items: EventFormMediaItem[] = (event.event_images ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((image) => ({
      kind: 'image',
      image: { id: image.id ?? null, uri: image.image, name: `image-${image.id ?? image.order}.jpg`, type: 'image/jpeg' },
    }));

  if (event.video) {
    const videoItem: EventFormMediaItem = {
      kind: 'video',
      video: { uri: event.video, name: 'video.mp4', type: 'video/mp4', existing: true },
    };
    const position =
      typeof event.video_order === 'number' && Number.isInteger(event.video_order)
        ? Math.max(0, Math.min(event.video_order, items.length))
        : items.length;
    items.splice(position, 0, videoItem);
  }

  return items;
}

function toFormQuestion(question: NonNullable<EventDetail['questions_data']>[number]): EventFormQuestion {
  return {
    id: question.id,
    question: question.question,
    description: 'description' in question ? asString(question.description) : '',
    type: question.type,
    options: question.options ?? [],
    conditions: parseQuestionConditions('conditions' in question ? question.conditions : []),
    required: question.required,
  };
}

function readTimelines(event: EventDetail): EventFormTimelineItem[] {
  if (!('timelines' in event)) return [];
  const raw: unknown = event.timelines;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const idValue: unknown = 'id' in entry ? entry.id : null;
    return [
      {
        id:
          typeof idValue === 'string' && idValue.length > 0
            ? idValue
            : typeof idValue === 'number'
              ? String(idValue)
              : createTimelineItemId(),
        title: 'title' in entry ? asString(entry.title) : '',
        description: 'description' in entry ? asString(entry.description) : '',
        start_time: 'start_time' in entry ? asString(entry.start_time) : '',
        end_time: 'end_time' in entry ? asString(entry.end_time) : '',
      },
    ];
  });
}

function toFormCoupon(coupon: EventCoupon): EventFormCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    discount: coupon.discount,
    max_uses: coupon.max_uses,
    is_active: coupon.is_active,
    usage_count: coupon.usage_count,
  };
}

export function buildEventInitialValues(
  event: EventDetail,
  categories: Category[] | undefined,
  coupons: EventCoupon[] | undefined,
): EventFormInitialValues {
  return {
    title: event.title,
    description: event.description,
    category: resolveCategoryId(event, categories),
    type: event.type,
    currency: eventCurrencyCode(event),
    startDate: event.start_date,
    startTime: (event.start_time ?? '').slice(0, 5),
    endDate: event.end_date ?? '',
    endTime: (event.end_time ?? '').slice(0, 5),
    timeTba: Boolean(event.time_is_tba),
    eventLocationType: event.event_location_type === 'virtual' ? 'virtual' : 'physical',
    locationTba: event.location_is_tba,
    country: event.country,
    region: event.region,
    address: event.address,
    coordinates: readCoordinates(event),
    inDraft: event.in_draft,
    media: buildMediaItems(event),
    questions: (event.questions_data ?? []).map(toFormQuestion),
    timelines: readTimelines(event),
    coupons: (coupons ?? event.coupons ?? []).map(toFormCoupon),
    organizers: (event.organizers ?? []).map<SelectedOrganizer>((organizer) => ({
      id: Number(organizer.id),
      first_name: organizer.first_name,
      last_name: organizer.last_name,
      organization_name: organizer.organization_name,
      profile_image: organizer.profile_image,
    })),
    tickets: (event.ticket_types ?? [])
      .filter((ticket) => !ticket.is_archived)
      .map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        price: Number(ticket.price) || 0,
        quantity: ticket.quantity ?? null,
        comment: ticket.comment ?? '',
        isFree: (Number(ticket.price) || 0) === 0,
        saleStartDate: ticket.sale_start_date ?? null,
        saleEndDate: ticket.sale_end_date ?? null,
        isActive: ticket.is_active ?? true,
        qrCodeQuantity: ticket.qr_code_quantity ?? 1,
        showRemainingTickets: ticket.show_remaining_tickets ?? false,
        isTable: ticket.is_table ?? false,
        eventDay: ticket.event_day ?? null,
        quantityDiscounts: ticket.quantity_discounts ?? null,
      })),
  };
}
