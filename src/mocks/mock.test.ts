import { resolveMock } from './index';
import { matchHandler, mock, mockError, paginate } from './mock';

describe('mock router', () => {
  it('matches path params with or without a trailing slash', () => {
    const handlers = [mock('GET', '/api/v1/events/:id/', ({ params }) => params.id)];
    expect(matchHandler(handlers, 'GET', '/api/v1/events/42/')?.params).toEqual({ id: '42' });
    expect(matchHandler(handlers, 'GET', '/api/v1/events/42')?.params).toEqual({ id: '42' });
    expect(matchHandler(handlers, 'POST', '/api/v1/events/42/')).toBeNull();
    expect(matchHandler(handlers, 'GET', '/api/v1/events/42/extra/')).toBeNull();
  });

  it('paginates like DRF', () => {
    const page = paginate([1, 2, 3, 4, 5], { page: '2', page_size: '2' });
    expect(page).toEqual({ count: 5, next: '?page=3', previous: '?page=1', results: [3, 4] });
  });

  it('resolves core fixtures per signed-in organizer', async () => {
    const list = await resolveMock({
      method: 'POST',
      path: '/api/v1/statistics/event-list/',
      query: {},
      body: { page: 1 },
      token: 'mock-access-1001',
    });
    expect('data' in list && (list.data as { events: unknown[] }).events).toHaveLength(6);

    const missing = await resolveMock({ method: 'GET', path: '/api/v1/events/999999/', query: {}, body: undefined, token: null });
    expect(missing).toEqual({ error: { status: 404, data: { detail: 'Not found.' } } });
  });

  it('turns MockError into an RTK error and unknown routes into 404', async () => {
    expect(mockError(403).status).toBe(403);
    const unknown = await resolveMock({ method: 'GET', path: '/api/v1/nope/', query: {}, body: undefined, token: null });
    expect('error' in unknown && unknown.error.status).toBe(404);
  });
});
