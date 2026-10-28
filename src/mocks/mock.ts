export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockRequest {
  method: MockMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  token: string | null;
}

export type MockResolver = (request: MockRequest) => unknown;

export type MockResponse = MockResolver | object | string | number | boolean | null;

export interface MockHandler {
  method: MockMethod;
  pattern: string;
  matcher: RegExp;
  keys: string[];
  resolve: MockResolver;
  delay: number;
}

export class MockError {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {}
}

export const DEFAULT_MOCK_DELAY = 350;

function compile(pattern: string): { matcher: RegExp; keys: string[] } {
  const keys: string[] = [];
  const body = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { matcher: new RegExp(`^${body}/?$`), keys };
}

function isResolver(value: unknown): value is MockResolver {
  return typeof value === 'function';
}

export function mock(
  method: MockMethod,
  pattern: string,
  response: MockResponse,
  options?: { delay?: number },
): MockHandler {
  const { matcher, keys } = compile(pattern);
  return {
    method,
    pattern,
    matcher,
    keys,
    resolve: isResolver(response) ? response : () => response,
    delay: options?.delay ?? DEFAULT_MOCK_DELAY,
  };
}

export function mockError(status: number, data: unknown = { detail: 'Mock error' }): MockError {
  return new MockError(status, data);
}

export function matchHandler(
  handlers: MockHandler[],
  method: MockMethod,
  path: string,
): { handler: MockHandler; params: Record<string, string> } | null {
  for (const handler of handlers) {
    if (handler.method !== method) continue;
    const match = handler.matcher.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    handler.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1] ?? '');
    });
    return { handler, params };
  }
  return null;
}

export function bodyOf<T extends object>(request: MockRequest): Partial<T> {
  const body = request.body;
  if (body && typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
    return body as Partial<T>;
  }
  return {};
}

export function paginate<T>(items: T[], query: Record<string, string>, defaultPageSize = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Number(query.page_size) || defaultPageSize);
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    count: items.length,
    next: start + pageSize < items.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results,
  };
}

export function isoDate(offsetDays: number, base = new Date()): string {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isoDateTime(offsetDays: number, time = '12:00:00', base = new Date()): string {
  return `${isoDate(offsetDays, base)}T${time}`;
}
