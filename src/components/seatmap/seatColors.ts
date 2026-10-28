import type { SeatPalette } from '@/lib/seating/seatPaths';

export interface SeatMapTheme extends SeatPalette {
  canvas: string;
  selectedRing: string;
  label: string;
  seatLabel: string;
  stage: string;
  stageLabel: string;
}

const LIGHT: SeatMapTheme = {
  canvas: '#f2f2f2',
  selected: '#2b3a44',
  selectedRing: '#ffffff',
  reserved: '#b9c2cc',
  sold: '#7d8590',
  unavailable: '#dfe3e8',
  label: '#45545f',
  seatLabel: '#1c2430',
  stage: '#2b3a44',
  stageLabel: '#ffffff',
};

const DARK: SeatMapTheme = {
  canvas: '#0a0d10',
  selected: '#f9f9f9',
  selectedRing: '#0a0d10',
  reserved: '#5b6673',
  sold: '#3a434c',
  unavailable: '#232a30',
  label: '#c4cad1',
  seatLabel: '#0a0d10',
  stage: '#1f262b',
  stageLabel: '#f9f9f9',
};

export function seatMapTheme(isDark: boolean): SeatMapTheme {
  return isDark ? DARK : LIGHT;
}
