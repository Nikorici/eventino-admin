import { baseApi } from './baseApi';

const base = '/api/v1/printing';

export const printingEndpoints = {
  agents: `${base}/agents/`,
  pairingCode: `${base}/agents/pairing-code/`,
  agent: (uuid: string) => `${base}/agents/${uuid}/`,
  revokeAgent: (uuid: string) => `${base}/agents/${uuid}/revoke/`,
  printers: `${base}/printers/`,
  printer: (uuid: string) => `${base}/printers/${uuid}/`,
  testPrint: (uuid: string) => `${base}/printers/${uuid}/test/`,
  templates: `${base}/templates/`,
  template: (id: number) => `${base}/templates/${id}/`,
  templatePreview: `${base}/templates/preview/`,
  templateLogo: (id: number) => `${base}/templates/${id}/logo/`,
  eventSettings: (eventId: number) => `${base}/events/${eventId}/settings/`,
  doors: (eventId: number) => `${base}/events/${eventId}/doors/`,
  jobs: `${base}/jobs/`,
  reprint: (uuid: string) => `${base}/jobs/${uuid}/reprint/`,
  approve: (uuid: string) => `${base}/jobs/${uuid}/approve/`,
  cancel: (uuid: string) => `${base}/jobs/${uuid}/cancel/`,
  resolve: (uuid: string) => `${base}/jobs/${uuid}/resolve/`,
  labelData: `${base}/label-data/`,
  labelPreview: `${base}/label-preview/`,
  ticketSearch: (eventId: number) => `${base}/events/${eventId}/tickets/`,
} as const;

export type ConnectionType = 'USB' | 'NETWORK';
export type MediaKind = 'DIE_CUT' | 'CONTINUOUS';
export type PrinterOrientation = 'AUTO' | 'PORTRAIT' | 'LANDSCAPE';
export type JobStatus =
  | 'AWAITING_REVIEW'
  | 'QUEUED'
  | 'CLAIMED'
  | 'PRINTING'
  | 'PRINTED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'CANCELLED';

export interface PrintAgent {
  uuid: string;
  name: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

export interface PrinterRef {
  uuid: string;
  name: string;
  connection_type: ConnectionType | null;
  agent_uuid?: string | null;
  agent_name?: string | null;
  agent_revoked_at?: string | null;
  agent_last_seen_at?: string | null;
}

export interface Printer extends PrinterRef {
  status: string;
  status_detail: string | null;
  detected_media_kind: MediaKind | null;
  detected_media_width_mm: number | null;
  detected_media_length_mm: number | null;
  override_kind: MediaKind | null;
  override_width_mm: number | null;
  override_height_mm: number | null;
  orientation: PrinterOrientation;
  rotation_deg: number;
  margin_left_mm: number | null;
  margin_right_mm: number | null;
  margin_top_mm: number | null;
  margin_bottom_mm: number | null;
  archived_at: string | null;
}

export type PrinterUpdate = Partial<
  Pick<
    Printer,
    | 'name'
    | 'orientation'
    | 'rotation_deg'
    | 'margin_left_mm'
    | 'margin_right_mm'
    | 'margin_top_mm'
    | 'margin_bottom_mm'
    | 'override_kind'
    | 'override_width_mm'
    | 'override_height_mm'
  >
> & { archived?: boolean };

export type TextSize = 'S' | 'M' | 'L';
export type LogoPlacement = 'top' | 'left';

export interface LabelLayout {
  preset: string;
  fields: string[];
  text_size?: TextSize | null;
  align?: string | null;
  qr_source?: string | null;
  qr_position?: string | null;
  qr_size?: TextSize | null;
  logo?: LogoPlacement | null;
  custom_text?: string | null;
  sizes?: Record<string, TextSize> | null;
}

export interface LabelTemplate {
  id: number;
  name: string;
  event_id: number | null;
  layout: LabelLayout | null;
  has_logo?: boolean;
}

export interface EventPrintSettings {
  auto_print_enabled: boolean;
  review_before_print: boolean;
  default_printer_uuid: string | null;
  default_template_id: number | null;
  default_copies: number;
}

export interface DoorPrinter extends PrinterRef {
  source: 'default' | 'assignment';
}

export interface Door {
  user_id: number;
  name: string;
  email: string;
  assigned_printer_uuid: string | null;
  effective_printer: DoorPrinter | null;
}

export interface FreeLabel {
  texts?: Record<string, string>;
  hidden?: string[];
  qr_value?: string;
}

export interface LabelOverrides {
  texts?: Record<string, string>;
  hidden?: string[];
}

export interface PrintJob {
  uuid: string;
  status: JobStatus;
  created_at: string;
  ticket_id: number | null;
  ticket_type: string | null;
  holder_name: string | null;
  holder_name_override?: boolean;
  free_label?: FreeLabel | null;
  label_overrides?: LabelOverrides | null;
  printer_uuid: string | null;
  printer_name: string | null;
  connection_type: ConnectionType | null;
  template_id: number | null;
  error_code: string | null;
  error_detail: string | null;
  resolved_by_id?: number | null;
}

export interface JobsPage {
  results: PrintJob[];
  count: number;
  page: number;
  pages: number;
}

export interface LabelData {
  holder_name?: string;
  company?: string;
  job_title?: string;
  ticket_type?: string;
  event_title?: string;
  custom?: string;
  lines: string[];
  has_qr: boolean;
  template_id: number | null;
}

export interface TicketSearchResult {
  id: number;
  holder_name: string | null;
  ticket_type: string | null;
  scanned: boolean;
}

export interface LabelEdits {
  holder_name?: string;
  label_overrides?: LabelOverrides;
}

export interface ManualJobBody extends LabelEdits {
  ticket_id?: number;
  event_id?: number;
  printer_uuid: string;
  template_id: number;
  copies?: number;
  client_request_id: string;
  free_label?: FreeLabel;
}

export interface LabelPreviewBody extends LabelEdits {
  ticket_id?: number;
  event_id?: number;
  printer_uuid: string;
  template_id?: number;
  free_label?: FreeLabel;
}

export interface LayoutPreviewBody {
  printer_uuid: string;
  layout: LabelLayout;
  logo?: string;
  template_id?: number;
}

export interface LogoFile {
  uri: string;
  name: string;
  type: string;
}

interface UploadFormData {
  append(name: string, value: string | LogoFile): void;
}

const UploadFormDataCtor: { new (): UploadFormData } = FormData;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('preview failed'));
    reader.readAsDataURL(blob);
  });
}

async function imageResponse(response: Response): Promise<unknown> {
  if (!response.ok) return response.json().catch(() => null);
  return readAsDataUrl(await response.blob());
}

const withEvent = (url: string, eventId?: number) => (eventId ? `${url}?event=${eventId}` : url);

export const printingApi = baseApi
  .enhanceEndpoints({
    addTagTypes: ['PrintAgents', 'Printers', 'PrintTemplates', 'PrintSettings', 'PrintDoors', 'PrintJobs'],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getPrintAgents: builder.query<PrintAgent[], void>({
        query: () => printingEndpoints.agents,
        providesTags: ['PrintAgents'],
      }),
      createPairingCode: builder.mutation<{ code: string; expires_at: string }, void>({
        query: () => ({ url: printingEndpoints.pairingCode, method: 'POST', body: {} }),
      }),
      renameAgent: builder.mutation<PrintAgent, { uuid: string; name: string }>({
        query: ({ uuid, name }) => ({ url: printingEndpoints.agent(uuid), method: 'PATCH', body: { name } }),
        invalidatesTags: ['PrintAgents', 'Printers'],
      }),
      revokeAgent: builder.mutation<PrintAgent, string>({
        query: (uuid) => ({ url: printingEndpoints.revokeAgent(uuid), method: 'POST', body: {} }),
        invalidatesTags: ['PrintAgents', 'Printers'],
      }),
      getPrinters: builder.query<Printer[], number | void>({
        query: (eventId) => withEvent(printingEndpoints.printers, eventId ?? undefined),
        providesTags: ['Printers'],
      }),
      updatePrinter: builder.mutation<Printer, { uuid: string; values: PrinterUpdate }>({
        query: ({ uuid, values }) => ({ url: printingEndpoints.printer(uuid), method: 'PATCH', body: values }),
        invalidatesTags: ['Printers', 'PrintDoors'],
      }),
      testPrint: builder.mutation<unknown, { uuid: string; template_id: number; client_request_id: string }>({
        query: ({ uuid, ...body }) => ({ url: printingEndpoints.testPrint(uuid), method: 'POST', body }),
        invalidatesTags: ['Printers'],
      }),
      getLabelTemplates: builder.query<LabelTemplate[], number | void>({
        query: (eventId) => withEvent(printingEndpoints.templates, eventId ?? undefined),
        providesTags: ['PrintTemplates'],
      }),
      createLabelTemplate: builder.mutation<LabelTemplate, { name: string; layout: LabelLayout; event_id: number | null }>({
        query: (body) => ({ url: printingEndpoints.templates, method: 'POST', body }),
        invalidatesTags: ['PrintTemplates'],
      }),
      updateLabelTemplate: builder.mutation<LabelTemplate, { id: number; name: string; layout: LabelLayout }>({
        query: ({ id, ...body }) => ({ url: printingEndpoints.template(id), method: 'PATCH', body }),
        invalidatesTags: ['PrintTemplates'],
      }),
      previewLayout: builder.mutation<string, LayoutPreviewBody>({
        query: (body) => ({
          url: printingEndpoints.templatePreview,
          method: 'POST',
          body,
          responseHandler: imageResponse,
        }),
      }),
      getTemplateLogo: builder.query<string, { id: number; version: number }>({
        query: ({ id }) => ({ url: printingEndpoints.templateLogo(id), responseHandler: imageResponse }),
      }),
      uploadTemplateLogo: builder.mutation<LabelTemplate, { id: number; file: LogoFile }>({
        query: ({ id, file }) => {
          const body = new UploadFormDataCtor();
          body.append('logo', file);
          return { url: printingEndpoints.templateLogo(id), method: 'POST', body };
        },
        invalidatesTags: ['PrintTemplates'],
      }),
      deleteTemplateLogo: builder.mutation<unknown, number>({
        query: (id) => ({ url: printingEndpoints.templateLogo(id), method: 'DELETE' }),
        invalidatesTags: ['PrintTemplates'],
      }),
      getEventPrintSettings: builder.query<EventPrintSettings, number>({
        query: (eventId) => printingEndpoints.eventSettings(eventId),
        providesTags: ['PrintSettings'],
      }),
      updateEventPrintSettings: builder.mutation<
        EventPrintSettings,
        { eventId: number; values: Partial<EventPrintSettings> }
      >({
        query: ({ eventId, values }) => ({ url: printingEndpoints.eventSettings(eventId), method: 'PATCH', body: values }),
        invalidatesTags: ['PrintSettings', 'PrintDoors'],
      }),
      getDoors: builder.query<{ doors: Door[] }, number>({
        query: (eventId) => printingEndpoints.doors(eventId),
        providesTags: ['PrintDoors'],
      }),
      assignDoor: builder.mutation<Door, { eventId: number; user_id: number; printer_uuid: string | null }>({
        query: ({ eventId, ...body }) => ({ url: printingEndpoints.doors(eventId), method: 'PUT', body }),
        invalidatesTags: ['PrintDoors'],
      }),
      getPrintJobs: builder.query<
        JobsPage,
        { eventId: number; status?: JobStatus; page?: number; pageSize?: number }
      >({
        query: ({ eventId, status, page, pageSize }) => ({
          url: printingEndpoints.jobs,
          params: { event: eventId, status, page, page_size: pageSize },
        }),
        providesTags: ['PrintJobs'],
      }),
      createManualJob: builder.mutation<PrintJob, ManualJobBody>({
        query: (body) => ({ url: printingEndpoints.jobs, method: 'POST', body }),
        invalidatesTags: ['PrintJobs'],
      }),
      reprintJob: builder.mutation<PrintJob, LabelEdits & { uuid: string; client_request_id: string; free_label?: FreeLabel }>({
        query: ({ uuid, ...body }) => ({ url: printingEndpoints.reprint(uuid), method: 'POST', body }),
        invalidatesTags: ['PrintJobs'],
      }),
      approveJob: builder.mutation<PrintJob, LabelEdits & { uuid: string }>({
        query: ({ uuid, ...body }) => ({ url: printingEndpoints.approve(uuid), method: 'POST', body }),
        invalidatesTags: ['PrintJobs'],
      }),
      cancelJob: builder.mutation<PrintJob, string>({
        query: (uuid) => ({ url: printingEndpoints.cancel(uuid), method: 'POST', body: {} }),
        invalidatesTags: ['PrintJobs'],
      }),
      resolveJob: builder.mutation<
        PrintJob,
        LabelEdits & { uuid: string; action: 'mark_printed' | 'reprint'; client_request_id?: string }
      >({
        query: ({ uuid, ...body }) => ({ url: printingEndpoints.resolve(uuid), method: 'POST', body }),
        invalidatesTags: ['PrintJobs'],
      }),
      getLabelData: builder.query<LabelData, { ticketId?: number; eventId?: number; templateId?: number }>({
        query: ({ ticketId, eventId, templateId }) => ({
          url: printingEndpoints.labelData,
          params: ticketId ? { ticket: ticketId, template: templateId } : { event: eventId, template: templateId },
        }),
      }),
      previewLabel: builder.mutation<string, LabelPreviewBody>({
        query: (body) => ({
          url: printingEndpoints.labelPreview,
          method: 'POST',
          body,
          responseHandler: imageResponse,
        }),
      }),
      searchPrintTickets: builder.query<{ results: TicketSearchResult[] }, { eventId: number; q: string }>({
        query: ({ eventId, q }) => ({ url: printingEndpoints.ticketSearch(eventId), params: { q } }),
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetPrintAgentsQuery,
  useCreatePairingCodeMutation,
  useRenameAgentMutation,
  useRevokeAgentMutation,
  useGetPrintersQuery,
  useUpdatePrinterMutation,
  useTestPrintMutation,
  useGetLabelTemplatesQuery,
  useCreateLabelTemplateMutation,
  useUpdateLabelTemplateMutation,
  usePreviewLayoutMutation,
  useGetTemplateLogoQuery,
  useUploadTemplateLogoMutation,
  useDeleteTemplateLogoMutation,
  useGetEventPrintSettingsQuery,
  useUpdateEventPrintSettingsMutation,
  useGetDoorsQuery,
  useAssignDoorMutation,
  useGetPrintJobsQuery,
  useCreateManualJobMutation,
  useReprintJobMutation,
  useApproveJobMutation,
  useCancelJobMutation,
  useResolveJobMutation,
  useGetLabelDataQuery,
  usePreviewLabelMutation,
  useSearchPrintTicketsQuery,
} = printingApi;
