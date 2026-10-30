import type {
  AvailableScannerUser,
  EventScanner,
  ScannerTicketType,
} from "@/store/api/scannersApi";

import { findMockEvent, mockEvents } from "./core";
import { bodyOf, isoDateTime, mock, mockError, type MockHandler } from "./mock";

interface ScannerBody {
  event: number;
  user: number;
  email: string;
  scan_all: boolean;
  ticket_type_ids: number[];
}

const directory: AvailableScannerUser[] = [
  {
    id: 2101,
    first_name: "Ion",
    last_name: "Rusu",
    email: "ion.rusu@gmail.com",
  },
  {
    id: 2102,
    first_name: "Maria",
    last_name: "Ciobanu",
    email: "maria.ciobanu@gmail.com",
  },
  {
    id: 2103,
    first_name: "Andrei",
    last_name: "Lungu",
    email: "andrei.lungu@gmail.com",
  },
  {
    id: 2104,
    first_name: "Elena",
    last_name: "Cojocaru",
    email: "elena.cojocaru@gmail.com",
  },
  {
    id: 2105,
    first_name: "Victor",
    last_name: "Munteanu",
    email: "victor.munteanu@gmail.com",
  },
  {
    id: 2106,
    first_name: "Cristina",
    last_name: "Botnaru",
    email: "cristina.botnaru@gmail.com",
  },
  {
    id: 2107,
    first_name: "Cristian",
    last_name: "Popa",
    email: "cristian.popa@gmail.com",
  },
  {
    id: 2108,
    first_name: "Natalia",
    last_name: "Grosu",
    email: "natalia.grosu@yahoo.com",
  },
  {
    id: 2109,
    first_name: "Mihai",
    last_name: "Ceban",
    email: "mihai.ceban@mail.ru",
  },
  {
    id: 2110,
    first_name: "Ana",
    last_name: "Popescu",
    email: "ana.popescu@gmail.com",
  },
];

let nextUserId = 2200;

function ticketTypesOf(eventId: number): ScannerTicketType[] {
  return (findMockEvent(eventId)?.ticketTypes ?? []).map((type) => ({
    id: type.id,
    name: type.name,
    is_archived: false,
  }));
}

function scopeTypes(eventId: number, ids: number[]): ScannerTicketType[] {
  return ticketTypesOf(eventId).filter((type) => ids.includes(type.id));
}

function userById(id: number): AvailableScannerUser | undefined {
  return directory.find((user) => user.id === id);
}

function makeScanner(
  id: number,
  eventId: number,
  user: AvailableScannerUser,
  ticketTypeIds: number[] | null,
  pending = false,
): EventScanner {
  return {
    id,
    event: eventId,
    user: user.id,
    user_details: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    },
    added_at: isoDateTime(-12),
    scan_all: ticketTypeIds == null,
    ticket_types:
      ticketTypeIds == null ? [] : scopeTypes(eventId, ticketTypeIds),
    is_pending_invite: pending,
    invite_email: pending ? user.email : null,
    invite_sent_at: pending ? isoDateTime(-2) : null,
    invite_accepted_at: null,
  };
}

function seed(): EventScanner[] {
  const user = (id: number) => userById(id) ?? directory[0];
  return [
    makeScanner(1, 4101, user(2101), null),
    makeScanner(2, 4101, user(2102), null),
    makeScanner(3, 4101, user(2103), [53]),
    makeScanner(4, 4101, user(2104), [51, 52]),
    makeScanner(5, 4101, user(2105), null, true),
    ...mockEvents
      .filter(
        (event) =>
          event.id !== 4101 &&
          !event.isCancelled &&
          event.ticketTypes.length > 0,
      )
      .slice(0, 2)
      .map((event, index) =>
        makeScanner(10 + index, event.id, user(2108 + index), null),
      ),
  ];
}

const scanners: EventScanner[] = seed();
let nextScannerId = 100;

function normalizedScope(body: Partial<ScannerBody>, eventId: number) {
  const scanAll = body.scan_all !== false;
  return {
    scan_all: scanAll,
    ticket_types: scanAll
      ? []
      : scopeTypes(eventId, body.ticket_type_ids ?? []),
  };
}

export const handlers: MockHandler[] = [
  mock("GET", "/api/v1/event_scanners/ticket-types/", ({ query }) =>
    ticketTypesOf(Number(query.event_id)),
  ),
  mock("GET", "/api/v1/event_scanners/available-users/", ({ query }) => {
    const eventId = Number(query.event_id);
    const term = (query.q ?? "").trim().toLowerCase();
    const taken = new Set(
      scanners
        .filter((scanner) => scanner.event === eventId)
        .map((scanner) => scanner.user),
    );
    return directory
      .filter((user) => !taken.has(user.id))
      .filter((user) =>
        [user.first_name, user.last_name, user.email].some((value) =>
          (value ?? "").toLowerCase().includes(term),
        ),
      )
      .slice(0, Number(query.limit) || 10);
  }),
  mock("POST", "/api/v1/event_scanners/invite/", (request) => {
    const body = bodyOf<ScannerBody>(request);
    const eventId = Number(body.event);
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email) return mockError(400, { email: ["This field is required."] });
    const existing = directory.find((user) => user.email === email);
    const user: AvailableScannerUser = existing ?? {
      id: nextUserId++,
      first_name: "",
      last_name: "",
      email,
    };
    if (!existing) directory.push(user);
    const scanner: EventScanner = {
      ...makeScanner(nextScannerId++, eventId, user, null, !existing),
      ...normalizedScope(body, eventId),
      added_at: new Date().toISOString(),
    };
    scanners.push(scanner);
    return { ...scanner, account_created: !existing, invite_sent: !existing };
  }),
  mock("GET", "/api/v1/event_scanners/", ({ query }) =>
    scanners.filter((scanner) => scanner.event === Number(query.event_id)),
  ),
  mock("POST", "/api/v1/event_scanners/", (request) => {
    const body = bodyOf<ScannerBody>(request);
    const eventId = Number(body.event);
    const user = userById(Number(body.user));
    if (!user) return mockError(404, { detail: "User not found." });
    if (
      scanners.some(
        (scanner) => scanner.event === eventId && scanner.user === user.id,
      )
    ) {
      return mockError(400, {
        detail: "This user is already a scanner for this event.",
      });
    }
    const scanner: EventScanner = {
      ...makeScanner(nextScannerId++, eventId, user, null),
      ...normalizedScope(body, eventId),
      added_at: new Date().toISOString(),
    };
    scanners.push(scanner);
    return scanner;
  }),
  mock("PATCH", "/api/v1/event_scanners/:id/", (request) => {
    const scanner = scanners.find(
      (item) => item.id === Number(request.params.id),
    );
    if (!scanner) return mockError(404, { detail: "Not found." });
    Object.assign(
      scanner,
      normalizedScope(bodyOf<ScannerBody>(request), scanner.event),
    );
    return scanner;
  }),
  mock("DELETE", "/api/v1/event_scanners/:id/", ({ params }) => {
    const index = scanners.findIndex(
      (scanner) => scanner.id === Number(params.id),
    );
    if (index < 0) return mockError(404, { detail: "Not found." });
    scanners.splice(index, 1);
    return {};
  }),
];
