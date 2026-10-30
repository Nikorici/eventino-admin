import type { ScannedTicket } from '@/store/api/stickersApi';

import { mock, mockError, type MockHandler } from './mock';

const EVENT_TITLE = 'Festivalul Vinului — Ediția de Toamnă';

const people: [string, string | null, string, number | null][] = [
  ['Ana Popescu', 'Château Vartely', 'VIP Lounge', 3101],
  ['Mihai Ceban', 'Purcari', 'Abonament 2 zile', 3102],
  ['Irina Bivol', null, 'Acces o zi', 3103],
  ['Cristina Botnaru', null, 'Acces o zi', null],
  ['Natalia Grosu', 'Asconi', 'Abonament 2 zile', 3105],
  ['Dumitru Rotaru', 'Mileștii Mici', 'VIP Lounge', 3106],
  ['Sergiu Țurcanu', 'Fautor', 'Acces o zi', 3107],
  ['Vlad Sârbu', null, 'Acces o zi', 3108],
  ['Ludmila Cazacu', 'Cricova', 'Abonament 2 zile', 3109],
  ['Andreea Popa', 'Maib', 'Acces o zi', 3110],
  ['Radu Ungureanu', 'Castel Mimi', 'VIP Lounge', 3111],
  ['Olga Cebotari', null, 'Acces o zi', 3112],
  ['Victor Munteanu', 'Orange Moldova', 'VIP Lounge', 3113],
  ['Elena Rusu', null, 'Abonament 2 zile', 3114],
  ['Ion Ciobanu', 'Moldcell', 'Acces o zi', 3115],
];

const scanned: ScannedTicket[] = people.map(([attendee_name, company, ticket_type, user_id], index) => ({
  uuid: `5c1e0a7e-41f0-4c1a-9b2e-${String(100000000000 + index)}`,
  attendee_name,
  company,
  ticket_type,
  event_id: 4101,
  event_title: EVENT_TITLE,
  scan_date: new Date(Date.now() - (index * 2 + 1) * 60000).toISOString(),
  user_id,
}));

const PAGE_SIZE = 10;

const profiles: Record<number, string> = { 3103: 'Moldcell', 3108: 'Starnet', 3114: 'Banca Transilvania' };

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/tickets/scanned/', ({ query }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const start = (page - 1) * PAGE_SIZE;
    return { results: scanned.slice(start, start + PAGE_SIZE), page, has_more: start + PAGE_SIZE < scanned.length };
  }),
  mock('GET', '/api/v1/networking/profiles/:userId/', ({ params }) => {
    const company = profiles[Number(params.userId)];
    return company ? { id: Number(params.userId), company } : mockError(404, { detail: 'Not found.' });
  }),
];
