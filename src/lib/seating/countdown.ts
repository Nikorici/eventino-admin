function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

export function serverOffsetMs(serverTime: string, clientNowMs: number): number {
  const serverMs = parseTimestamp(serverTime);
  return Number.isNaN(serverMs) ? 0 : serverMs - clientNowMs;
}

export function remainingSeconds(expiresAt: string, offsetMs: number, clientNowMs: number): number {
  const expiresMs = parseTimestamp(expiresAt);
  if (Number.isNaN(expiresMs)) return 0;
  const serverNowMs = clientNowMs + offsetMs;
  return Math.max(0, Math.floor((expiresMs - serverNowMs) / 1000));
}

export function isExpired(expiresAt: string, offsetMs: number, clientNowMs: number): boolean {
  return remainingSeconds(expiresAt, offsetMs, clientNowMs) <= 0;
}

export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}
