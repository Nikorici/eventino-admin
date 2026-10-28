export interface SeatingApiError {
  status: number | null;
  code: string | null;
  message: string | null;
  unavailableSeatIds: number[];
}

function readNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number');
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseSeatingError(error: unknown): SeatingApiError {
  const empty: SeatingApiError = { status: null, code: null, message: null, unavailableSeatIds: [] };
  if (typeof error !== 'object' || error === null) return empty;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
  if (!('data' in error) || typeof error.data !== 'object' || error.data === null) return { ...empty, status };
  const data: object = error.data;
  const code = 'code' in data ? readString(data.code) : null;
  const detail = 'detail' in data ? readString(data.detail) : null;
  const message = 'message' in data ? readString(data.message) : null;
  const unavailableSeatIds = 'unavailable_seat_ids' in data ? readNumberList(data.unavailable_seat_ids) : [];
  return { status, code, message: detail ?? message, unavailableSeatIds };
}
