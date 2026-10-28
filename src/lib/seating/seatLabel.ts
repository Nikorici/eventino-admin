export interface SeatLabelSource {
  section_name: string;
  row_label: string;
  seat_label: string;
}

export type SeatLabelTranslate = (key: string, options: { row: string; seat: string }) => string;

export function formatSeatLine(seat: SeatLabelSource, t: SeatLabelTranslate): string {
  return `${seat.section_name} · ${t('Row {{row}}, seat {{seat}}', { row: seat.row_label, seat: seat.seat_label })}`;
}
