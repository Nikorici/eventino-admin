import { endpoints } from '@/lib/constants';
import type { User } from '@/types/api';

import { MOCK_INVALID_CODE } from './auth';
import { currentMockUser, linkedAccountOf, linkedNicknames, mockUsers } from './core';
import { bodyOf, mock, mockError, type MockHandler, type MockRequest } from './mock';

function organizer(id: number, email: string, first: string, last: string, city: string, country: string): User {
  return {
    id,
    email,
    first_name: first,
    last_name: last,
    organization_name: null,
    is_organization: true,
    city,
    country,
    profile_image: null,
    is_full_confirmation: true,
    is_email_confirmed: true,
    is_staff: false,
    events_created_count: 0,
  };
}

const unlinkedAccounts: User[] = [
  organizer(1004, 'maria.popescu@agentiaevent.ro', 'Maria', 'Popescu', 'Iași', 'Romania'),
  organizer(1005, 'victor.ceban@gmail.com', 'Victor', 'Ceban', 'Bălți', 'Moldova'),
  organizer(1006, 'ana.rusu@icloud.com', 'Ana', 'Rusu', 'Chișinău', 'Moldova'),
];
const googleAccountEmail = 'victor.ceban@gmail.com';
const appleAccountEmail = 'ana.rusu@icloud.com';

const links = new Set<string>();
const pair = (a: number, b: number) => `${a}:${b}`;

function linkedUsers(id: number): User[] {
  return mockUsers.filter((user) => user.id !== id && links.has(pair(id, user.id)));
}

function linkGroups(a: number, b: number): void {
  const group = new Set([a, b, ...linkedUsers(a).map((user) => user.id), ...linkedUsers(b).map((user) => user.id)]);
  group.forEach((x) => group.forEach((y) => x !== y && links.add(pair(x, y))));
}

mockUsers.forEach((user) => linkGroups(mockUsers[0].id, user.id));

function accountByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return [...mockUsers, ...unlinkedAccounts].find((user) => user.email === normalized);
}

function finalizeLink(request: MockRequest, target: User, nickname: string | undefined) {
  const current = currentMockUser(request);
  if (target.id === current.id) return mockError(400, { detail: 'cannot link to self' });
  if (!mockUsers.includes(target)) mockUsers.push(target);
  linkGroups(current.id, target.id);
  if (nickname?.trim()) linkedNicknames[target.id] = nickname.trim();
  return linkedAccountOf(target);
}

export const handlers: MockHandler[] = [
  mock('GET', endpoints.linkedAccounts, (request: MockRequest) =>
    linkedUsers(currentMockUser(request).id).map(linkedAccountOf),
  ),
  mock('DELETE', `${endpoints.linkedAccounts}:id/`, (request: MockRequest) => {
    const current = currentMockUser(request).id;
    const target = Number(request.params.id);
    if (current === target) return mockError(400, { detail: 'cannot unlink self' });
    links.delete(pair(current, target));
    links.delete(pair(target, current));
    return {};
  }),
  mock('POST', `${endpoints.linkedAccounts}link-otp/`, (request: MockRequest) => {
    const body = bodyOf<{ email: string; otp_code: string; nickname: string }>(request);
    if (!body.email || !body.otp_code) return mockError(400, { detail: 'email and otp_code required' });
    const target = accountByEmail(body.email);
    if (!target) return mockError(404, { detail: 'no Eventino account exists for this email' });
    if (body.otp_code === MOCK_INVALID_CODE) return mockError(400, { detail: 'invalid or expired OTP' });
    return finalizeLink(request, target, body.nickname);
  }),
  mock('POST', `${endpoints.linkedAccounts}link-google/`, (request: MockRequest) => {
    const body = bodyOf<{ access_token: string; nickname: string }>(request);
    if (!body.access_token) return mockError(400, { detail: 'access_token required' });
    const target = accountByEmail(googleAccountEmail);
    return target ? finalizeLink(request, target, body.nickname) : mockError(400, { detail: 'invalid Google token' });
  }),
  mock('POST', `${endpoints.linkedAccounts}link-apple/`, (request: MockRequest) => {
    const body = bodyOf<{ identity_token: string; nickname: string }>(request);
    if (!body.identity_token) return mockError(400, { detail: 'identity_token required' });
    const target = accountByEmail(appleAccountEmail);
    return target ? finalizeLink(request, target, body.nickname) : mockError(400, { detail: 'invalid Apple identity token' });
  }),
];
