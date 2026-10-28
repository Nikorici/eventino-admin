# EA-4 — Event selection (organizer hub)

Route `/select-event` (`src/app/select-event.tsx`). Shown after sign-in when no event is selected, and whenever the user
taps the selected-event title/bar to switch. Mirrors the web organizer hub:

- `pages/dashboard/index.js`: Heading, OrganizerSwitcher, NumericStats, Analytics, EventList
- `pages/dashboard/events/index.js`: EventTable with search, the "List of Events" sidebar item
- `components/OrganizerSwitcher/*` + `redux/multiOrganizer/*`: the account delegate / multi-organizer switcher

Design source: eventino-mobile `src/app/organizer.tsx`, `components/dashboard/OrganizerSwitcher.tsx`,
`components/dashboard/DashboardStats.tsx`.

## Sections in order

| # | Web | Mobile | Status |
|---|---|---|---|
| 1 | Page title (Event List / DashBoard) | GlassHeader "Select an event", back only when there is history | done |
| 2 | `Heading`: "Welcome, {first_name}" + "Here is the information about all your events" | `Welcome, {{name}}` + subtitle | done |
| 3 | `OrganizerSwitcher` (compact trigger: avatar + name + caret) | avatar button in the header right slot, opens the switcher sheet | done |
| 4 | `NumericStats` "Statistics": interval All Time / This Week / Previous Week | "Statistics" heading + interval selector (DashboardStatsSection) | done |
| 5 | Metric cards: Total Users, Total Revenue, Tickets Sold, Total Received (sum without invoices, invoice amount in brackets), Total Tickets, Paid Tickets, Free Tickets; "↗ all time" sub-values | same cards, per currency, plus Scanned / Not Scanned Tickets (eventino-mobile) | done |
| 6 | `Analytics` "Event Analytics": month/week/day, prev/next period, revenue line, users/tickets/favorites | AnalyticsChart (hand-drawn svg, tap for tooltip) | done |
| 7 | Create event (TopNavBar / sidebar button) | primary GlassButton "Create event" → `/create-event` modal | done |
| 8 | `EventList` "List of Events" + search input "Search events..." (name contains, case-insensitive) | heading + GlassInput search | done |
| 9 | Event cards, sorted by start date, newest first | OrganizerEventCard list (FlashList) | done |
| 10 | Card tap → `/dashboard/events/[id]` | stores the selection (selectedEvent slice + storage), then `navigate.dismissTo('dashboard')`: pops back to the tabs when they are below, else replaces | done |
| 11 | — | current selection marked: 2px border + green check on the poster | done |

## Event card fields

| Web (EventTable) | Mobile |
|---|---|
| thumbnail image (placeholder when none) | BlurredPoster (placeholder icon when none) |
| status pill: Draft / Live / Today / Finished / Upcoming (`getEventTimeStatus`) | same pill + Cancelled (eventino-mobile) |
| date badge day + month, "d Mon yyyy — d Mon yyyy" | "Tue, 26 Jan — Wed, 27 Jan" (single day when start = end) |
| location "region, country" | MapPin row |
| participants, tickets | Users / Ticket counters |
| revenue "412500.00 MDL" | "MDL 412500" in the event currency, never converted |

## Organizer switcher (sheet)

| Web dropdown | Mobile sheet |
|---|---|
| "Active organizer": avatar, full name, email | same, green check |
| linked accounts: avatar, name, nickname or email; tap → switch; "Unlink" with confirm "Unlink this account?" | same rows, Link2Off button + Alert confirm |
| empty: "No linked organizers yet." | same |
| switch success toast "Switched organizer" / "Failed to switch account" | same toasts; session swapped, API cache reset, event list re-scoped |
| "Add organizer account" → modal "Link another organizer" | button at the bottom of the sheet → AddOrganizerAccountModal |
| modal: Nickname (optional label), Continue with Google / Apple / email code | same three choices (Google/Apple gated like the login screen); email code: email → 6-digit code → Link account, Change email, Back |

## States

- Loading: two OrganizerEventCardSkeleton cards; stats show DashboardStatsSkeleton.
- Empty: "You haven't created any events yet." + Create event action.
- No search match: "No events match your search."
- Error: "Something went wrong." + "Try again" (refetch).
- Pull to refresh: refetches the event list, the all-events stats and the daily graph.
- Switching organizer clears the selection mark (selection is scoped to the organizer id).

## Endpoints

| Method + URL | Web source | App |
|---|---|---|
| POST `/api/v1/statistics/event-list/` `{page, page_size}` | `api/eventApi.js` fetchEventListStatistics | organizerApi.getOrganizerEvents (core mock) |
| POST `/api/v1/statistics/get-recent-stats/` `{time_interval}` | `api/eventApi.js` fetchEventStatistics | organizerApi.getOrganizerStats (dashboard.ts mock, EA-5) |
| POST `/api/v1/statistics/get-stats-graph/` `{time_interval: day \| hour, target_date?}` | `api/eventApi.js` fetchEventAnalytics | organizerApi.getOrganizerGraph + DashboardStats hourly (dashboard.ts mock, EA-5) |
| GET `/api/v1/linked-accounts/` | `redux/multiOrganizer/action-creators.js` fetchLinkedAccounts | linkedAccountsApi (select-event mock) |
| POST `/api/v1/auth/switch/:id/` | switchAccount | linkedAccountsApi (core mock) |
| DELETE `/api/v1/linked-accounts/:id/` | unlinkAccount | linkedAccountsApi (select-event mock) |
| POST `/api/v1/verifications/send_otp_login/` `{email}` | `redux/auth` sendOTPLogin | authApi.sendOtp (auth.ts mock, EA-3) |
| POST `/api/v1/linked-accounts/link-otp/` `{email, otp_code, nickname}` | linkAccountWithOtp | linkedAccountsApi (select-event mock) |
| POST `/api/v1/linked-accounts/link-google/` `{access_token, nickname}` | linkAccountWithGoogle | linkedAccountsApi (select-event mock) |
| POST `/api/v1/linked-accounts/link-apple/` `{identity_token, user, nickname, platform}` | linkAccountWithApple (`platform: 'ios'`, as the app's Apple login) | linkedAccountsApi (select-event mock) |
| GET `/api/v1/users/:id/` | `redux/user` getUser (after switch) | usersApi (core mock) |

## Not ported

- Dashboard tour (nextstepjs) and its Start/Replay button.
- CurrencySelector (BNM conversion of mixed-currency totals): the app shows each currency separately.
- EventTable pagination (`showPagination`): the app scrolls one list, like the web's 1000-row fetch.

## Mock behaviour (`src/mocks/select-event.ts`)

Mirrors `LinkedAccountViewSet`: links are symmetric pairs and linking merges both groups; unlink removes one pair only.
`link-otp` answers 404 for an email with no Eventino account, 400 for code `000000` or a self link. Existing unlinked
accounts: `maria.popescu@agentiaevent.ro` (email code), Victor Ceban (Google), Ana Rusu (Apple).
