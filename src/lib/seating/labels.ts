import type { LabelAnchor, LayoutSection, LocalizedText } from '@/types/seating';

import { pointsBounds } from './seatIndex';

export const ROW_LABEL_GAP_FACTOR = 2.6;

export interface LabelPosition {
  key: string;
  x: number;
  y: number;
  text: string;
}

export interface SectionLabelPosition {
  x: number;
  y: number;
  rotation: number;
  anchor: LabelAnchor;
  text: string;
}

export function localizedText(fallback: string, i18n: LocalizedText | null | undefined, language: string): string {
  const short = language.split('-')[0];
  return i18n?.[short] ?? i18n?.en ?? fallback;
}

export function rowLabelPositions(section: LayoutSection, seatRadius: number): LabelPosition[] {
  const { mode, x: fixedX } = section.row_labels;
  if (mode === 'none') return [];
  const positions: LabelPosition[] = [];
  for (const row of section.rows) {
    if (row.seats.length === 0) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let sumY = 0;
    for (const seat of row.seats) {
      if (seat.x < minX) minX = seat.x;
      if (seat.x > maxX) maxX = seat.x;
      sumY += seat.y;
    }
    const y = sumY / row.seats.length;
    const [left, right] =
      mode === 'fixed' && fixedX
        ? fixedX
        : [minX - seatRadius * ROW_LABEL_GAP_FACTOR, maxX + seatRadius * ROW_LABEL_GAP_FACTOR];
    positions.push({ key: `${row.id}:l`, x: left, y, text: row.label });
    positions.push({ key: `${row.id}:r`, x: right, y, text: row.label });
  }
  return positions;
}

export function sectionLabelPosition(section: LayoutSection, language: string): SectionLabelPosition | null {
  const text = localizedText(section.name, section.name_i18n, language);
  if (section.label) return { ...section.label, text };
  if (section.outline.length < 3) return null;
  const bounds = pointsBounds(section.outline);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    rotation: 0,
    anchor: 'middle',
    text,
  };
}
