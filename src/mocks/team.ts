import type { AccountDelegate, AddDelegateBody, AvailableDelegateUser, DelegatePermissionFlags } from '@/store/api/teamApi';

import { currentMockUser, mockLinkedOrganizers } from './core';
import { bodyOf, isoDateTime, mock, mockError, type MockHandler } from './mock';

const jazz = mockLinkedOrganizers[0];

const directory: AvailableDelegateUser[] = [
  { id: 2102, first_name: 'Maria', last_name: 'Ciobanu', email: 'maria.ciobanu@gmail.com', profile_image: null },
  { id: 2101, first_name: 'Ion', last_name: 'Rusu', email: 'ion.rusu@gmail.com', profile_image: null },
  {
    id: jazz.id,
    first_name: '',
    last_name: '',
    email: jazz.email,
    profile_image: null,
    is_organization: true,
    organization_name: jazz.organization_name,
  },
  { id: 2104, first_name: 'Elena', last_name: 'Cojocaru', email: 'elena.cojocaru@gmail.com', profile_image: null },
  { id: 2110, first_name: 'Ana', last_name: 'Popescu', email: 'ana.popescu@gmail.com', profile_image: null },
  { id: 2103, first_name: 'Andrei', last_name: 'Lungu', email: 'andrei.lungu@gmail.com', profile_image: null },
  { id: 2105, first_name: 'Victor', last_name: 'Munteanu', email: 'victor.munteanu@gmail.com', profile_image: null },
  { id: 2106, first_name: 'Cristina', last_name: 'Botnaru', email: 'cristina.botnaru@gmail.com', profile_image: null },
  { id: 2108, first_name: 'Natalia', last_name: 'Grosu', email: 'natalia.grosu@yahoo.com', profile_image: null },
  { id: 2111, first_name: 'Sergiu', last_name: 'Țurcanu', email: 'sergiu.turcanu@gmail.com', profile_image: null },
  {
    id: 2112,
    first_name: '',
    last_name: '',
    email: 'office@moldovasound.md',
    profile_image: null,
    is_organization: true,
    organization_name: 'Moldova Sound SRL',
  },
];

function userById(id: number): AvailableDelegateUser {
  return directory.find((entry) => entry.id === id) ?? { id, email: null };
}

function delegate(id: number, principal: number, userId: number, flags: DelegatePermissionFlags, daysAgo: number): AccountDelegate {
  return {
    id,
    principal,
    delegate: userId,
    principal_details: { id: principal },
    delegate_details: userById(userId),
    created_at: isoDateTime(-daysAgo),
    ...flags,
  };
}

const delegates: AccountDelegate[] = [
  delegate(1, 1001, 2102, { can_edit: true, can_post: true, can_delete: false }, 60),
  delegate(2, 1001, 2101, { can_edit: true, can_post: false, can_delete: false }, 41),
  delegate(3, 1001, jazz.id, { can_edit: false, can_post: true, can_delete: false }, 18),
  delegate(4, 1001, 2104, { can_edit: false, can_post: false, can_delete: false }, 6),
];

function matches(user: AvailableDelegateUser, needle: string): boolean {
  return [user.first_name, user.last_name, user.organization_name, user.email, `${user.first_name ?? ''} ${user.last_name ?? ''}`]
    .some((value) => (value ?? '').toLowerCase().includes(needle));
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/account-delegates/available-users/', (request) => {
    const principal = currentMockUser(request).id;
    const needle = (request.query.q ?? '').trim().toLowerCase();
    const limit = Number(request.query.limit) || 10;
    const taken = new Set(delegates.filter((row) => row.principal === principal).map((row) => row.delegate));
    return directory
      .filter((user) => user.id !== principal && !taken.has(user.id) && matches(user, needle))
      .slice(0, limit);
  }),
  mock('GET', '/api/v1/account-delegates/', (request) => {
    const principal = currentMockUser(request).id;
    return delegates.filter((row) => row.principal === principal);
  }),
  mock('POST', '/api/v1/account-delegates/', (request) => {
    const principal = currentMockUser(request).id;
    const body = bodyOf<AddDelegateBody>(request);
    if (!body.delegate) return mockError(400, { delegate: ['This field is required.'] });
    if (delegates.some((row) => row.principal === principal && row.delegate === body.delegate)) {
      return mockError(400, { non_field_errors: ['This user is already on your team.'] });
    }
    const created = delegate(
      Math.max(0, ...delegates.map((row) => row.id)) + 1,
      principal,
      body.delegate,
      { can_edit: Boolean(body.can_edit), can_post: Boolean(body.can_post), can_delete: Boolean(body.can_delete) },
      0,
    );
    delegates.push(created);
    return created;
  }),
  mock('PATCH', '/api/v1/account-delegates/:id/', (request) => {
    const index = delegates.findIndex((row) => row.id === Number(request.params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    delegates[index] = { ...delegates[index], ...bodyOf<DelegatePermissionFlags>(request) };
    return delegates[index];
  }),
  mock('DELETE', '/api/v1/account-delegates/:id/', ({ params }) => {
    const index = delegates.findIndex((row) => row.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    delegates.splice(index, 1);
    return {};
  }),
];
