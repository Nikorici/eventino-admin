import type {
  AddEventStaffBody,
  AvailableStaffUser,
  EventStaffMember,
  StaffPermissions,
} from '@/store/api/staffApi';

import { bodyOf, isoDateTime, mock, mockError, type MockHandler } from './mock';

const directory: AvailableStaffUser[] = [
  { id: 2101, first_name: 'Ion', last_name: 'Rusu', email: 'ion.rusu@gmail.com' },
  { id: 2102, first_name: 'Maria', last_name: 'Ciobanu', email: 'maria.ciobanu@gmail.com' },
  { id: 2104, first_name: 'Elena', last_name: 'Cojocaru', email: 'elena.cojocaru@gmail.com' },
  { id: 2105, first_name: 'Victor', last_name: 'Munteanu', email: 'victor.munteanu@gmail.com' },
  { id: 2110, first_name: 'Ana', last_name: 'Popescu', email: 'ana.popescu@gmail.com' },
  { id: 2103, first_name: 'Andrei', last_name: 'Lungu', email: 'andrei.lungu@gmail.com' },
  { id: 2111, first_name: 'Sergiu', last_name: 'Țurcanu', email: 'sergiu.turcanu@gmail.com' },
  { id: 2106, first_name: 'Cristina', last_name: 'Botnaru', email: 'cristina.botnaru@gmail.com' },
  { id: 2108, first_name: 'Natalia', last_name: 'Grosu', email: 'natalia.grosu@yahoo.com' },
  { id: 2109, first_name: 'Mihai', last_name: 'Ceban', email: 'mihai.ceban@mail.ru' },
  { id: 2112, is_organization: true, organization_name: 'Moldova Sound SRL', email: 'office@moldovasound.md' },
];

const FULL: StaffPermissions = {
  permission: 'full',
  can_view_buyers: true,
  can_view_analytics: true,
  can_manage_tickets: true,
  can_manage_orders: true,
  can_manage_forms: true,
  can_manage_scanners: true,
};

const NONE: StaffPermissions = {
  permission: 'view_only',
  can_view_buyers: false,
  can_view_analytics: false,
  can_manage_tickets: false,
  can_manage_orders: false,
  can_manage_forms: false,
  can_manage_scanners: false,
};

function member(id: number, event: number, userId: number, permissions: Partial<StaffPermissions>, daysAgo: number): EventStaffMember {
  const user = directory.find((entry) => entry.id === userId) ?? directory[0];
  return {
    id,
    event,
    user: user.id,
    added_at: isoDateTime(-daysAgo),
    user_details: user,
    ...NONE,
    ...permissions,
  };
}

const staff: EventStaffMember[] = [
  member(1, 4101, 2101, FULL, 40),
  member(2, 4101, 2102, { can_view_buyers: true, can_view_analytics: true }, 32),
  member(3, 4101, 2104, { can_view_buyers: true, can_view_analytics: true, can_manage_tickets: true, can_manage_orders: true }, 20),
  member(4, 4101, 2105, { can_manage_scanners: true }, 6),
  member(5, 4102, 2110, FULL, 14),
  member(6, 4102, 2103, { can_view_buyers: true, can_view_analytics: true }, 9),
  member(7, 4104, 2112, { can_view_analytics: true, can_manage_forms: true }, 3),
];

let nextStaffId = 100;

function permissionsFrom(body: Partial<StaffPermissions>, base: StaffPermissions): StaffPermissions {
  return {
    permission: body.permission ?? base.permission,
    can_view_buyers: body.can_view_buyers ?? base.can_view_buyers,
    can_view_analytics: body.can_view_analytics ?? base.can_view_analytics,
    can_manage_tickets: body.can_manage_tickets ?? base.can_manage_tickets,
    can_manage_orders: body.can_manage_orders ?? base.can_manage_orders,
    can_manage_forms: body.can_manage_forms ?? base.can_manage_forms,
    can_manage_scanners: body.can_manage_scanners ?? base.can_manage_scanners,
  };
}

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/event_staff/available-users/', ({ query }) => {
    const eventId = Number(query.event_id);
    const term = (query.q ?? '').trim().toLowerCase();
    const taken = new Set(staff.filter((entry) => entry.event === eventId).map((entry) => entry.user));
    return directory
      .filter((user) => !taken.has(user.id))
      .filter((user) =>
        [user.first_name, user.last_name, user.email, user.organization_name].some((value) =>
          (value ?? '').toLowerCase().includes(term),
        ),
      )
      .slice(0, Number(query.limit) || 10);
  }),
  mock('GET', '/api/v1/event_staff/my-permissions/', { is_staff_member: false }),
  mock('GET', '/api/v1/event_staff/', ({ query }) => staff.filter((entry) => entry.event === Number(query.event_id))),
  mock('POST', '/api/v1/event_staff/', (request) => {
    const body = bodyOf<AddEventStaffBody>(request);
    const user = directory.find((entry) => entry.id === Number(body.user));
    if (!user || !body.event) return mockError(400, { user: ['Invalid user.'] });
    if (staff.some((entry) => entry.event === body.event && entry.user === user.id)) {
      return mockError(400, { message: 'User is already staff for this event' });
    }
    const created: EventStaffMember = {
      id: nextStaffId++,
      event: body.event,
      user: user.id,
      added_at: new Date().toISOString(),
      user_details: user,
      ...permissionsFrom(body, NONE),
    };
    staff.push(created);
    return created;
  }),
  mock('PATCH', '/api/v1/event_staff/:id/', (request) => {
    const target = staff.find((entry) => entry.id === Number(request.params.id));
    if (!target) return mockError(404, { detail: 'Not found.' });
    Object.assign(target, permissionsFrom(bodyOf<StaffPermissions>(request), target));
    return target;
  }),
  mock('DELETE', '/api/v1/event_staff/:id/', ({ params }) => {
    const index = staff.findIndex((entry) => entry.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    staff.splice(index, 1);
    return {};
  }),
];
