import { baseApi } from './baseApi';

const facturaEndpoints = {
  facturaOrders: '/api/v1/tickets/factura-orders/',
  facturaIndividualOrders: '/api/v1/tickets/factura-individual-orders/',
  editInvoiceSerial: '/api/v1/tickets/edit-invoice-serial/',
} as const;

export const facturaDownloadEndpoint = {
  pdf: (orderId: number) => `/api/v1/tickets/download-factura/?order_id=${orderId}`,
  xml: (orderId: number) => `/api/v1/tickets/download-factura-xml/?order_id=${orderId}`,
} as const;

export const SERIAL_EDITABLE_EVENT_ID = 1471;

export type FacturaCustomerType = 'all' | 'juridice' | 'fizice';

export interface FacturaOrderUser {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  company_iban?: string | null;
  company_address?: string | null;
}

export interface FacturaOrderTicket {
  ticket_type_name?: string | null;
  price?: string | null;
}

export interface FacturaOrder {
  id: number;
  user?: FacturaOrderUser | null;
  order_date?: string | null;
  total_price?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  invoice_after_payment?: boolean;
  invoice_sent?: boolean;
  factura_sent?: boolean;
  invoice_serial?: string | null;
  invoice_serial_number?: number | null;
  invoice_serial_prefix?: string | null;
  factura_downloaded?: boolean;
  factura_downloaded_at?: string | null;
  tickets?: FacturaOrderTicket[];
}

export interface FacturaOrdersParams {
  eventId: number;
  customerType: FacturaCustomerType;
}

export interface EditInvoiceSerialParams {
  orderId: number;
  invoiceSerialNumber: number;
}

export interface EditInvoiceSerialResponse {
  id: number;
  invoice_serial: string;
  invoice_serial_number: number;
}

function toOrderList(response: FacturaOrder[] | { results?: FacturaOrder[] }): FacturaOrder[] {
  return Array.isArray(response) ? response : (response?.results ?? []);
}

export const facturaApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['FacturaOrders', 'FacturaIndividualOrders'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getFacturaOrders: builder.query<FacturaOrder[], FacturaOrdersParams>({
        query: ({ eventId, customerType }) =>
          `${facturaEndpoints.facturaOrders}?event_id=${eventId}&customer_type=${customerType}`,
        transformResponse: toOrderList,
        providesTags: (_result, _error, { eventId }) => [{ type: 'FacturaOrders', id: eventId }],
      }),
      getFacturaIndividualOrders: builder.query<FacturaOrder[], FacturaOrdersParams>({
        query: ({ eventId, customerType }) =>
          `${facturaEndpoints.facturaIndividualOrders}?event_id=${eventId}&customer_type=${customerType}`,
        transformResponse: toOrderList,
        providesTags: (_result, _error, { eventId }) => [{ type: 'FacturaIndividualOrders', id: eventId }],
      }),
      editInvoiceSerial: builder.mutation<EditInvoiceSerialResponse, EditInvoiceSerialParams>({
        query: ({ orderId, invoiceSerialNumber }) => ({
          url: facturaEndpoints.editInvoiceSerial,
          method: 'POST',
          body: { order_id: orderId, invoice_serial_number: invoiceSerialNumber },
        }),
        invalidatesTags: ['FacturaIndividualOrders'],
      }),
    }),
    overrideExisting: false,
  });

export const { useGetFacturaOrdersQuery, useGetFacturaIndividualOrdersQuery, useEditInvoiceSerialMutation } =
  facturaApi;
