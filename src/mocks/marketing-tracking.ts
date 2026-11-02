import { currentMockUser, mockOrganizer, mockUsers } from './core';
import { mock, mockError, type MockHandler } from './mock';

Object.assign(mockOrganizer, { meta_pixel_id: '1284637790215543', tiktok_pixel_id: '' });

function coerce(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function bodyFields(body: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (typeof body !== 'object' || body === null) return fields;
  if ('getParts' in body && typeof body.getParts === 'function') {
    const parts: unknown = body.getParts();
    if (Array.isArray(parts)) {
      parts.forEach((part: unknown) => {
        if (typeof part === 'object' && part !== null && 'fieldName' in part && typeof part.fieldName === 'string' && 'string' in part && typeof part.string === 'string') {
          fields[part.fieldName] = coerce(part.string);
        }
      });
    }
    return fields;
  }
  if ('forEach' in body && typeof body.forEach === 'function') {
    body.forEach((value: unknown, key: unknown) => {
      if (typeof key === 'string' && typeof value === 'string') fields[key] = coerce(value);
    });
    return fields;
  }
  Object.entries(body).forEach(([key, value]) => {
    fields[key] = coerce(value);
  });
  return fields;
}

export const handlers: MockHandler[] = [
  mock('PATCH', '/api/v1/users/:id/', (request) => {
    const index = mockUsers.findIndex((candidate) => candidate.id === Number(request.params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    if (mockUsers[index].id !== currentMockUser(request).id) {
      return mockError(403, { detail: 'You can update only your own account.' });
    }
    const updated = { ...mockUsers[index], ...bodyFields(request.body) };
    mockUsers[index] = updated;
    return updated;
  }),
];
