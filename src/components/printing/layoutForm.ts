import type { LabelLayout, LogoPlacement, MediaKind, Printer, TextSize } from '@/store/api/printingApi';

export const PRESETS: Record<string, { allowed: string[]; fallback: string }> = {
  name_type_qr: { allowed: ['name', 'ticket_type', 'event_title', 'custom', 'qr'], fallback: 'name' },
  name_company_qr: {
    allowed: ['name', 'company', 'job_title', 'ticket_type', 'event_title', 'custom', 'qr'],
    fallback: 'name',
  },
  big_name: { allowed: ['name', 'ticket_type', 'company', 'job_title', 'event_title', 'custom'], fallback: 'name' },
  qr_only: { allowed: ['qr'], fallback: 'qr' },
};

export const PRESET_KEYS = Object.keys(PRESETS);
export const TEXT_SIZES: TextSize[] = ['S', 'M', 'L'];
export const ALIGNMENTS = ['left', 'center'];
export const QR_SOURCES = ['conecta', 'ticket'];
export const QR_POSITIONS = ['right', 'left', 'bottom'];
export const LOGO_PLACEMENTS: (LogoPlacement | null)[] = ['top', 'left', null];
export const CUSTOM_TEXT_MAX = 40;

export interface LayoutForm {
  preset: string;
  fields: Record<string, boolean>;
  order: string[];
  sizes: Record<string, TextSize>;
  keys: string[];
  nullKeys: string[];
  textSize: TextSize;
  align: string;
  qrSource: string;
  qrPosition: string;
  qrSize: TextSize;
  logo: LogoPlacement | null;
  customText: string;
}

type OptionalKey = 'text_size' | 'align' | 'qr_source' | 'qr_position' | 'qr_size' | 'logo' | 'custom_text';
type OptionalFormKey = 'textSize' | 'align' | 'qrSource' | 'qrPosition' | 'qrSize' | 'logo' | 'customText';

const OPTIONAL_KEYS: [OptionalKey, OptionalFormKey, string | null][] = [
  ['text_size', 'textSize', 'M'],
  ['align', 'align', 'left'],
  ['qr_source', 'qrSource', 'ticket'],
  ['qr_position', 'qrPosition', 'right'],
  ['qr_size', 'qrSize', 'M'],
  ['logo', 'logo', null],
  ['custom_text', 'customText', ''],
];

export const isTextField = (field: string) => field !== 'qr';

const initialOrder = (allowed: string[], fields: string[]) => {
  const placed = fields.filter((field, index) => allowed.includes(field) && fields.indexOf(field) === index);
  return [...placed, ...allowed.filter((field) => !placed.includes(field))];
};

const isTextSize = (value: unknown): value is TextSize => value === 'S' || value === 'M' || value === 'L';
const isLogo = (value: unknown): value is LogoPlacement => value === 'top' || value === 'left';

export function layoutFromForm(form: LayoutForm): LabelLayout {
  const preset = PRESETS[form.preset];
  const order = initialOrder(preset.allowed, form.order.length ? form.order : preset.allowed);
  const picked = order.filter((field) => form.fields[field]);
  const fields = picked.length ? picked : [preset.fallback];
  const layout: LabelLayout = { preset: form.preset, fields };
  const assign: Record<string, unknown> = {};
  OPTIONAL_KEYS.forEach(([key, formKey, fallback]) => {
    const value = form[formKey];
    if (value === fallback && form.nullKeys.includes(key)) assign[key] = null;
    else if (form.keys.includes(key) || value !== fallback) assign[key] = value;
  });
  const sizes: Record<string, TextSize> = {};
  Object.entries(form.sizes).forEach(([field, size]) => {
    if (fields.includes(field) && isTextField(field)) sizes[field] = size;
  });
  if (!Object.keys(sizes).length && form.nullKeys.includes('sizes')) assign.sizes = null;
  else if (form.keys.includes('sizes') || Object.keys(sizes).length) assign.sizes = sizes;
  return { ...layout, ...assign };
}

export function formFromLayout(layout: LabelLayout): LayoutForm {
  const preset = PRESETS[layout.preset] ? layout.preset : 'name_type_qr';
  const saved = layout.fields ?? [];
  const fields: Record<string, boolean> = {};
  PRESETS[preset].allowed.forEach((field) => {
    fields[field] = saved.includes(field);
  });
  const entries: [string, unknown][] = Object.entries(layout);
  return {
    preset,
    fields,
    order: initialOrder(PRESETS[preset].allowed, saved),
    sizes: { ...(layout.sizes ?? {}) },
    keys: entries.filter(([key]) => key !== 'preset' && key !== 'fields').map(([key]) => key),
    nullKeys: entries.filter(([, value]) => value === null).map(([key]) => key),
    textSize: isTextSize(layout.text_size) ? layout.text_size : 'M',
    align: layout.align ?? 'left',
    qrSource: layout.qr_source ?? 'ticket',
    qrPosition: layout.qr_position ?? 'right',
    qrSize: isTextSize(layout.qr_size) ? layout.qr_size : 'M',
    logo: isLogo(layout.logo) ? layout.logo : null,
    customText: layout.custom_text ?? '',
  };
}

export function changePreset(form: LayoutForm, preset: string): LayoutForm {
  const allowed = PRESETS[preset].allowed;
  const kept = ['name', 'qr'].filter((field) => allowed.includes(field));
  const next = formFromLayout({ preset, fields: kept.length ? kept : [PRESETS[preset].fallback] });
  const sizes: Record<string, TextSize> = {};
  Object.entries(form.sizes).forEach(([field, size]) => {
    if (allowed.includes(field)) sizes[field] = size;
  });
  return { ...form, preset, fields: next.fields, order: next.order, sizes };
}

export function moveLine(form: LayoutForm, field: string, step: number): LayoutForm {
  const order = initialOrder(PRESETS[form.preset].allowed, form.order);
  const lines = order.filter(isTextField);
  const from = lines.indexOf(field);
  const to = from + step;
  if (from < 0 || to < 0 || to >= lines.length) return form;
  [lines[from], lines[to]] = [lines[to], lines[from]];
  let cursor = 0;
  return { ...form, order: order.map((entry) => (isTextField(entry) ? lines[cursor++] : entry)) };
}

export function lineSize(form: LayoutForm, field: string): TextSize {
  if (form.sizes[field]) return form.sizes[field];
  const first = form.order.find((entry) => isTextField(entry) && form.fields[entry]);
  return first === field ? form.textSize : 'S';
}

export const emptyLayoutForm = (): LayoutForm =>
  formFromLayout({ preset: 'name_type_qr', fields: ['name', 'ticket_type', 'qr'], text_size: 'M', qr_source: 'conecta' });

export const DIE_CUT_SIZES: [number, number][] = [
  [17, 54], [17, 87], [23, 23], [29, 42], [29, 90], [38, 90],
  [39, 48], [52, 29], [54, 29], [60, 86], [62, 29], [62, 100],
];
export const CONTINUOUS_WIDTHS = [12, 29, 38, 50, 54, 62];
export const ORIENTATIONS = ['AUTO', 'PORTRAIT', 'LANDSCAPE'] as const;
export const ROTATIONS = [0, 90, 180, 270];

export interface PrinterForm {
  name: string;
  override_kind: MediaKind | '';
  override_width_mm: string;
  override_height_mm: string;
  orientation: (typeof ORIENTATIONS)[number];
  rotation_deg: number;
  margin_left_mm: string;
  margin_right_mm: string;
  margin_top_mm: string;
  margin_bottom_mm: string;
}

export function mediaMismatch(printer: Printer, form: PrinterForm): boolean {
  if (!form.override_kind || !printer.detected_media_kind) return false;
  if (form.override_kind !== printer.detected_media_kind) return true;
  if (form.override_kind === 'CONTINUOUS') return Number(form.override_width_mm) !== printer.detected_media_width_mm;
  return (
    Number(form.override_width_mm) !== printer.detected_media_width_mm ||
    Number(form.override_height_mm) !== printer.detected_media_length_mm
  );
}
