import { currentMockUser, eventsOf, mockEventDetail, mockEvents, mockOrganizer } from './core';
import { mock, type MockHandler } from './mock';

const STAFF_WINDOW_DAYS = 180;

Object.assign(mockOrganizer, {
  company_registration_number: 'J12/3456/2019',
  company_address: 'Str. Memorandumului 28, Cluj-Napoca',
  company_email: 'office@sunsetevents.md',
  company_phone: '0745123456',
  company_pays_tva: true,
  company_iban: 'RO49AAAA1B31007593840000',
  commission_paid_by: 'ORGANIZER',
  eventino_commission_percent: 5,
});

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/events/fiscalization-events/', (request) => {
    const user = currentMockUser(request);
    const events = user.is_staff
      ? mockEvents.filter((event) => event.ticketsSold > 0 && event.startOffset >= -STAFF_WINDOW_DAYS)
      : eventsOf(user);
    return { results: [...events].sort((a, b) => b.startOffset - a.startOffset).map(mockEventDetail) };
  }),
];
