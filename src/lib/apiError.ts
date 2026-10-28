export function extractApiError(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
  const data: unknown = error.data;
  if (typeof data === 'string') return data;
  if (typeof data !== 'object' || data === null) return undefined;
  if ('detail' in data && typeof data.detail === 'string') return data.detail;
  if ('message' in data && typeof data.message === 'string') return data.message;
  const values: unknown[] = Object.values(data);
  const first = values[0];
  if (typeof first === 'string') return first;
  if (Array.isArray(first)) {
    const head: unknown = first[0];
    if (typeof head === 'string') return head;
  }
  return undefined;
}

export function extractClientErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status: unknown = error.status;
  if (typeof status !== 'number' || status < 400 || status > 499) return undefined;
  return extractApiError(error);
}
