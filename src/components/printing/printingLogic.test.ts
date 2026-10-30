import type { Door, EventPrintSettings, PrintJob } from '@/store/api/printingApi';

import { changePreset, emptyLayoutForm, layoutFromForm, moveLine } from './layoutForm';
import { doorWarnings, formatCountdown, jobReason, printerFaultText, printingErrorText, splitByPrinter } from './printingLogic';

const t = (key: string, options?: Record<string, string | number>) =>
  options ? Object.entries(options).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key) : key;

const job = (extra: Partial<PrintJob>): PrintJob => ({
  uuid: 'a',
  status: 'FAILED',
  created_at: '',
  ticket_id: 1,
  ticket_type: null,
  holder_name: null,
  printer_uuid: 'p1',
  printer_name: null,
  connection_type: null,
  template_id: null,
  error_code: null,
  error_detail: null,
  ...extra,
});

describe('printing logic', () => {
  it('translates printer faults and server errors', () => {
    expect(printerFaultText('cover_open, media-jam', t)).toBe('The cover is open. The labels are jammed.');
    expect(jobReason(job({ error_detail: 'printer reports: end_of_media' }), t)).toBe('The label roll has run out.');
    expect(printingErrorText('printer has 62x100 mm loaded, job needs 58x80 mm', t)).toBe(
      'The printer has 62 x 100 mm labels loaded, but this label needs 58 x 80 mm.',
    );
  });

  it('warns about doors that print nothing or stay on the default', () => {
    const settings: EventPrintSettings = {
      auto_print_enabled: true,
      review_before_print: false,
      default_printer_uuid: 'p1',
      default_template_id: 1,
      default_copies: 1,
    };
    const printer = { uuid: 'p1', name: 'Zebra', connection_type: null };
    const doors: Door[] = [
      { user_id: 1, name: 'Ion', email: '', assigned_printer_uuid: 'p1', effective_printer: { ...printer, source: 'assignment' } },
      { user_id: 2, name: 'Ana', email: '', assigned_printer_uuid: null, effective_printer: { ...printer, source: 'default' } },
      { user_id: 3, name: 'Eva', email: '', assigned_printer_uuid: 'p2', effective_printer: null },
    ];
    expect(doorWarnings(doors, settings, t)).toEqual([
      'Eva is assigned to a printer that is archived or offline, so its scans print nothing.',
      'Ana still prints at the event default.',
    ]);
  });

  it('splits jobs by printer and formats the pairing countdown', () => {
    expect(splitByPrinter([job({}), job({ printer_uuid: 'p2' })], 'p1').hidden).toBe(1);
    expect(formatCountdown(125)).toBe('2:05');
  });

  it('builds layouts from the form', () => {
    const form = emptyLayoutForm();
    expect(layoutFromForm(form)).toEqual({
      preset: 'name_type_qr',
      fields: ['name', 'ticket_type', 'qr'],
      text_size: 'M',
      qr_source: 'conecta',
    });
    expect(layoutFromForm(moveLine(form, 'ticket_type', -1)).fields).toEqual(['ticket_type', 'name', 'qr']);
    expect(layoutFromForm(changePreset(form, 'qr_only')).fields).toEqual(['qr']);
  });
});
