import { baseApi } from './baseApi';

export const stickerEndpoints = {
  scanned: '/api/v1/tickets/scanned/',
  generate: '/api/v1/tickets/generate-sticker/',
} as const;

export type StickerSize = '58x80' | '50x30';

export const STICKER_SIZES: StickerSize[] = ['58x80', '50x30'];

export const SPECIAL_STICKER_EVENT_ID = 1246;

export interface ScannedTicket {
  uuid: string;
  attendee_name: string;
  company: string | null;
  ticket_type: string;
  event_id: number;
  event_title: string;
  scan_date: string;
}

export interface ScannedTicketsPage {
  results: ScannedTicket[];
  page: number;
  has_more: boolean;
}

export interface GenerateStickerBody {
  ticket_uuid: string;
  attendee_name: string;
  company: string;
  size: StickerSize;
  show_ticket_type: boolean;
}

export const stickersApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['ScannedTickets'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getScannedTickets: builder.query<ScannedTicketsPage, number>({
        query: (page) => `${stickerEndpoints.scanned}?page=${page}`,
        serializeQueryArgs: ({ endpointName }) => endpointName,
        merge: (currentCache, incoming, { arg }) => {
          if (arg <= 1) {
            currentCache.results = incoming.results;
          } else {
            const seen = new Set(currentCache.results.map((ticket) => ticket.uuid));
            incoming.results.forEach((ticket) => {
              if (!seen.has(ticket.uuid)) currentCache.results.push(ticket);
            });
          }
          currentCache.page = incoming.page;
          currentCache.has_more = incoming.has_more;
        },
        forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
        providesTags: ['ScannedTickets'],
      }),
    }),
    overrideExisting: false,
  });

export const { useGetScannedTicketsQuery } = stickersApi;
