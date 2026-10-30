import { mockOrganizer, mockUsers } from './core';
import { mock, mockError, type MockHandler } from './mock';

Object.assign(mockOrganizer, { meta_pixel_id: '1284637790215543', tiktok_pixel_id: '' });

function formFields(body: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (typeof body !== 'object' || body === null) return fields;
  if ('getParts' in body && typeof body.getParts === 'function') {
    const parts: unknown = body.getParts();
    if (Array.isArray(parts)) {
      parts.forEach((part: unknown) => {
        if (typeof part === 'object' && part !== null && 'fieldName' in part && typeof part.fieldName === 'string' && 'string' in part && typeof part.string === 'string') {
          fields[part.fieldName] = part.string;
        }
      });
    }
    return fields;
  }
  if ('forEach' in body && typeof body.forEach === 'function') {
    body.forEach((value: unknown, key: unknown) => {
      if (typeof key === 'string' && typeof value === 'string') fields[key] = value;
    });
    return fields;
  }
  Object.entries(body).forEach(([key, value]) => {
    if (typeof value === 'string') fields[key] = value;
  });
  return fields;
}

export const handlers: MockHandler[] = [
  mock('PATCH', '/api/v1/users/:id/', ({ params, body }) => {
    const index = mockUsers.findIndex((candidate) => candidate.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    const updated = { ...mockUsers[index], ...formFields(body) };
    mockUsers[index] = updated;
    return updated;
  }),
];
