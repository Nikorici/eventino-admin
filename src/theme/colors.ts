export const colors = {
  background: '#f2f2f2',
  surface: '#ffffff',
  primary: '#2b3a44',
  primaryLight: '#61859d',
  border: '#e9e9e9',
  links: '#61859d',
  white: '#ffffff',
  black: '#000000',
  accent: '#61859d',
  brand: '#61859d',
  brandDark: '#2b3a44',
  brandMid: '#45545f',
  success: '#15dd7d',
  buyBlue: '#61859d',
  checkoutIndigo: '#61859d',
  checkoutIndigoBg: '#eef3f7',
  viewTickets: '#61859d',
  stepper: '#61859d',
  offline: '#e7ee19',
  textLight: '#f9f9f9',
  danger: '#d83636',
  warning: '#e7ee19',
  muted: '#8a8d93',
  cardSm: '#f2f3f3',
  categoryBadge: 'rgba(43,58,68,0.72)',
  passedOverlay: 'rgba(128,128,128,0.6)',

  glass: {
    light: 'rgba(255,255,255,0.72)',
    lightStrong: 'rgba(255,255,255,0.85)',
    dark: 'rgba(30,30,30,0.65)',
    darkStrong: 'rgba(26,26,26,0.85)',
    border: 'rgba(255,255,255,0.35)',
    borderDark: 'rgba(255,255,255,0.12)',
    highlight: 'rgba(255,255,255,0.5)',
    shadow: 'rgba(0,0,0,0.08)',
  },

  dark: {
    background: '#0a0d10',
    surface: '#161b1f',
    elevated: '#1f262b',
    text: '#f9f9f9',
    textSecondary: '#8a8d93',
    border: '#2b343a',
  },

  statusBadge: {
    default: '#e0e0e0',
    today: '#f97316',
    tomorrow: '#d83636',
    thisWeek: '#2563eb',
    underWeek: '#3f87f5',
    thisMonth: '#9b59b6',
    nextMonth: '#ff6347',
    passed: '#e0e0e0',
  },
} as const;

export type AppColors = typeof colors;

export const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  MDL: 'MDL',
  RON: 'RON',
  GBP: '£',
};

export function currencySymbol(code?: string | null): string {
  if (!code) return '';
  return currencySymbols[code] ?? code;
}
