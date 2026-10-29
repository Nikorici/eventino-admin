# Eventino Admin — Agent Guide

Organizer dashboard of the **eventino-frontend** web platform (`pages/dashboard/**`, `pages/create-event.js`) as a phone
app: organizers configure their events and read statistics. Same Django REST API as the web, same design language as
**eventino-mobile** (Liquid Glass over the near-monochrome Eventino identity, Gilroy).

`docs/STRUCTURE.md` is the information architecture: every web sidebar item, the tab and route it lives in, and its
Jira ticket (project **EA**).

## Stack

| Concern | Choice |
|---------|--------|
| Runtime | Expo SDK 58 (RN 0.88, React 19.3, TypeScript 6). Runs in **Expo Go** |
| Navigation | Expo Router 58 (file-based, under `src/app/`), `NativeTabs` (`expo-router/native-tabs`) on iOS/Android, JS `Tabs` fallback on web |
| Styling | NativeWind 4 (Tailwind 3.4, `darkMode: 'class'`) — `tailwind.config.js` |
| State / data | Redux Toolkit + RTK Query (`src/store`) |
| Auth tokens | `expo-secure-store` on device, `localStorage` (via AsyncStorage) on web |
| Social auth | `expo-auth-session` (Google) + `expo-apple-authentication` — no Firebase, no native Google SDK |
| Glass | `expo-blur` + `expo-linear-gradient` + `expo-glass-effect` |
| Lists / images | `@shopify/flash-list`, `expo-image` |
| Misc | Reanimated 4 + Moti, lucide-react-native, `@gorhom/bottom-sheet`, RHF + Zod, i18next, date-fns |

Charts: eventino-mobile draws them by hand with `react-native-svg` (`src/components/dashboard/DashboardStats.tsx`).
Do the same. No chart library.

## Run

```bash
cd ~/eventino-admin
npx expo start            # scan the QR with Expo Go (SDK 58) on the phone
npx expo start --web      # fastest review loop in a browser
npx tsc --noEmit          # typecheck (must stay clean)
npx expo lint             # lint (0 errors; React Compiler rules are warnings)
npx expo-doctor           # dependency/health checks
npx jest                  # unit tests
npx expo export --platform ios --output-dir /tmp/export-ios   # full JS bundle smoke test
```

`.env` (copy `.env.example`):

```
EXPO_PUBLIC_API_URL=https://api.eventino.co
EXPO_PUBLIC_USE_MOCKS=true
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Expo Go constraints

- Every native dependency must be listed in `node_modules/expo/bundledNativeModules.json`. Check before adding one.
- Never add `@react-native-firebase/*`, `@react-native-google-signin/*`, `expo-build-properties`, local native modules
  (eventino-mobile's `modules/expo-wallet`) or config plugins that need a dev build.
- Google sign-in needs a native redirect scheme, so it is hidden in Expo Go (`isGoogleAuthReady` in
  `src/lib/social-auth.ts`). With mocks on, both social buttons sign in with a fake payload.
- `expo-notifications` is not installed (remote push is gone from Expo Go).
- Liquid Glass (`expo-glass-effect`) needs iOS 26; older iOS falls back to `BlurView`, Android to a translucent fill.

## Structure (everything under `src/`, alias `@/* → src/*`)

```
src/
  app/
    _layout.tsx              providers, fonts, splash, i18n, theme, auth + selected-event bootstrap, root Stack
    index.tsx                gate: no session → /login, else /home
    home.tsx                 all-events statistics + current event + "Select an event"         EA-44
    (auth)/                  login · register · forgot-password                          EA-3
    select-event.tsx         pick the event to manage (+ organizer switcher)             EA-4
    create-event.tsx         modal                                                       EA-6
    (tabs)/_layout.tsx       NativeTabs: Dashboard · Sales · Analytics · Manage · More (+ session/event guard)
    (tabs)/<tab>/_layout.tsx one Stack per tab, so pushed screens keep the tab bar
    (tabs)/<tab>/index.tsx   tab root (hub, or the event dashboard)
    (tabs)/<tab>/<screen>.tsx every other screen (stubs until their ticket lands)
  components/ui/             Liquid Glass primitives (AppText, GlassHeader/Card/Button/Input/Surface, Screen, Skeleton,
                             EmptyState, Chip, Badge, SegmentedControl, Stepper, PressableScale, Toast, DashedAddButton)
  components/navigation/     SectionHub, ToolRow/ToolSection, SelectedEventBar, AccountCard, StubScreen
  components/dashboard/      DashboardStats (svg charts), OrganizerSwitcher, CancelEventSheet
  components/events/         EventForm & friends, OrganizerEventCard, BlurredPoster, StatusBadge, PriceBadge
  components/{seatmap,messaging,shared,social,brand}/   copied from eventino-mobile
  store/                     index, hooks, api/ (baseApi + one slice per domain), slices/ (auth, selectedEvent, theme, ui)
  mocks/                     mock layer: mock.ts (helpers), core.ts (shared fixtures), <feature>.ts, index.ts (registry)
  lib/                       constants (endpoints), nav, sections, storage, social-auth, format, pricing, i18n, ...
  hooks/                     useAuth, useSelectedEvent, useSections, useScreenPadding, useGoogleSignIn, ...
  theme/                     colors, glass, fonts (Gilroy)
  types/                     api.ts (backend shapes), seating.ts
  locales/                   en/ro/ru translation.json (eventino-mobile verbatim + web-only keys merged in)
```

## Non-negotiable conventions

- **No comments in code.** No docstrings. Self-documenting names only.
- TypeScript strict — no `any`, no `@ts-ignore`, avoid assertions (route typing is centralised in `lib/nav.ts`).
- Styling only via NativeWind `className`; inline `style` only for dynamic values. All text uses `AppText`.
  Dark mode via `dark:` variants, or `useThemeColor(light, dark)` for values passed to icons/props.
- Reuse `src/components/ui` and the eventino-mobile components. Never invent a new visual language.
- Haptics on interactive presses (`GlassButton`/`Chip` self-fire; custom touchables call `haptics.*`).
- Routing only through `navigate.*` / `routes` in `@/lib/nav` — never hand-built strings in screens. A new route gets
  its entry in `routes` + `navigate` (additive edit).
- Every data screen handles loading (`Skeleton`), empty (`EmptyState`), error (EmptyState + retry) and pull-to-refresh.
- Layout: screens render `<Screen edges={[]}>` + `<GlassHeader title onBack={navigate.back} />` and pad their scroll
  content with `useScreenPadding()` (`top` clears the glass header, `bottom` clears the tab bar; pass `{ tabBar: false }`
  outside the tabs).
- The selected event: `useSelectedEvent()` → `{ eventId, data: EventDetail, isLoading, isError, refetch }`.
- Permissions: `eventPermissions(event, user)` in `lib/sections.ts` is the web's `useEventPermissions` — use it, don't
  re-derive.
- **PORT, DON'T INVENT**: every screen mirrors its web page (sections, order, fields, actions, copy). If eventino-mobile
  already ports the page (`~/eventino-mobile/src/app/...`), start from that screen and add what the web has that it lacks.

## API parity rules (mirror the web exactly)

- Auth header is `Authorization: ThemydaAPI <token>` — **never** `Bearer`. Refresh: `POST /api/token/refresh/`
  `{ refresh }`; single-flight 401 retry lives in `store/api/baseApi.ts`.
- **Token shape differs per endpoint:** `/api/login/` → `{access,refresh}`; `/api/v1/auth/social-login` →
  `{access_token,refresh_token,user}`; `verify_otp_login` → `{access,refresh,user,is_new_account}`. Handled in `hooks/useAuth.ts`.
- Login is **email OTP or password** (`/api/login/`, `send_otp_login`/`verify_otp_login`), **not** `/api/token/`.
- Organizer event list: `POST /api/v1/statistics/event-list/`; stats: `POST /api/v1/statistics/get-recent-stats/`
  (see `store/api/organizerApi.ts`). Event detail is fetched by **numeric id**: `GET /api/v1/events/:id/`.
- Money is per-currency; never convert or sum across currencies, EXCEPT the `/home` totals, which follow the web
  `CurrencySelector` (`components/MainDashBoard/NumericStats.js` + `CurencyContext.js`): one `event_currencies` entry →
  locked to it; more → every currency converted with BNM rates (MDL base, rate/nominal) and summed in the picked
  currency (`lib/currency.ts`, rates from `bnm.md` via `store/api/currencyApi.ts`).
- i18n keys are the **full English sentence** (natural-language keys), single `translation` namespace. Never dotted
  keys. Reuse the exact web/eventino-mobile key whenever the same text exists (so ro/ru already exist); a new key goes
  into all three locale files.
- Endpoint URLs come from `~/eventino-frontend/api/*.js`, `redux/**/routes*` or eventino-mobile `src/store/api/*.ts` —
  never guessed.

## Mock layer

`EXPO_PUBLIC_USE_MOCKS=true` swaps the RTK Query base query (`store/api/baseApi.ts`) for `resolveMock` in
`src/mocks/index.ts`. Endpoints, hooks and screens stay exactly as they will be against the real API; turning mocks
off is the whole wiring step.

How a feature adds data:

1. Add/extend the RTK Query endpoint in its `src/store/api/<domain>Api.ts` with the **real** URL.
2. Fill **your own** `src/mocks/<feature>.ts` (it already exists and is registered):

```ts
import { bodyOf, mock, mockError, type MockHandler } from './mock';

interface MockVoucher {
  id: number;
  event: number;
  code: string;
  discount: number;
  max_uses: number;
  usage_count: number;
  is_active: boolean;
}

const vouchers: MockVoucher[] = [
  { id: 1, event: 4101, code: 'TOAMNA20', discount: 20, max_uses: 100, usage_count: 37, is_active: true },
];

export const handlers: MockHandler[] = [
  mock('GET', '/api/v1/event_coupons/by-event/', ({ query }) =>
    vouchers.filter((voucher) => voucher.event === Number(query.event_id)),
  ),
  mock('POST', '/api/v1/event_coupons/', (request) => {
    const body = bodyOf<MockVoucher>(request);
    const created: MockVoucher = {
      id: vouchers.length + 1,
      event: body.event ?? 0,
      code: body.code ?? '',
      discount: body.discount ?? 0,
      max_uses: body.max_uses ?? 0,
      usage_count: 0,
      is_active: true,
    };
    vouchers.push(created);
    return created;
  }),
  mock('DELETE', '/api/v1/event_coupons/:id/', ({ params }) => {
    const index = vouchers.findIndex((voucher) => voucher.id === Number(params.id));
    if (index < 0) return mockError(404, { detail: 'Not found.' });
    vouchers.splice(index, 1);
    return {};
  }),
];
```

- `mock(method, pattern, response, { delay? })` — `pattern` uses `:param` segments and ignores the query string and the
  trailing slash; `response` is a value or `(request) => value`. `request` has `params`, `query` (URL query + RTK
  `params`), `body`, `token`. Default delay 350 ms, so skeletons are visible.
- `mockError(status, data)` returns an RTK error (`{ status, data }`); `paginate(items, query)` returns DRF pagination.
- Keep fixtures in module-level arrays and mutate them in handlers, so mutations succeed and invalidated queries refetch
  the new state.
- Fixtures import **only types** from `@/store/api/*` (a value import creates a require cycle through `baseApi`); URL
  constants come from `@/lib/constants` or are written inline.
- Feature handlers are matched **before** `core`, so a feature may deliberately override a core URL.
- Data must be realistic (Moldova/Romania, MDL/RON/EUR, Romanian names) and cover varied states.
- Unmatched requests return 404 and log `[mocks] No handler for ...` in the Metro/browser console.
- Downloads (`lib/downloads.ts`) return a small placeholder file while mocks are on.
- The SSE streams (`usePresaleRealtime`, `useSeatMapRealtime`) stay closed while mocks are on, so nothing reaches the
  real API with a mock token.

Shared fixtures live in `src/mocks/core.ts`:

| Export | What |
|---|---|
| `mockOrganizer` | signed-in organizer, id 1001, `andrei.ciobanu@sunsetevents.md`, "Sunset Events", `is_staff: MOCK_USER_IS_STAFF` (true, so every staff-only item shows; flip it to preview a plain organizer) |
| `mockLinkedOrganizers` | 1002 "Ethno Jazz Festival", 1003 "Cluj Live Events SRL" (organizer switcher) |
| `mockEvents` | 4101 live (MDL, rich sales), 4102 today (MDL), 4103 upcoming (RON), 4104 draft (EUR), 4105 finished (RON), 4106 cancelled (MDL); plus 4201 (owner 1002) and 4301 (owner 1003). Dates are relative to today |
| `mockEventDetail(e)` / `mockEventListItem(e)` | `EventDetail` / `OrganizerEventListItem` shapes |
| `findMockEvent(id)`, `eventsOf(user)`, `currentMockUser(request)` | helpers (the mock token `mock-access-<userId>` identifies the organizer) |

Core already answers: every auth endpoint (login/OTP/register/verify/reset/change password/refresh/social),
`GET /api/v1/users/:id/`, `POST /api/v1/users/user_login/`, linked accounts + `POST /api/v1/auth/switch/:id/`,
`GET /api/v1/account-delegates/my-delegators/`, `POST /api/v1/statistics/event-list/`, `GET /api/v1/events/:id/`,
`GET /api/v1/tickets/scanned/` (sticker-access probe).

## Navigation contract

- `src/lib/sections.ts` transcribes `~/eventino-frontend/components/SideBar/Sidebar.js`: groups, items, labels (same
  English keys), lucide icons, routes, Jira tickets and the **same visibility rules** (`requires` → `visible(access)`).
- Hubs (`sales`, `analytics`, `manage`, `more` index) render `SectionHub`, which reads `useSections(tab)`.
- A screen agent replaces its stub file in `src/app/(tabs)/<tab>/<screen>.tsx` and keeps the file name. Sub-screens go
  next to it (e.g. `sales/merch/orders/[oid].tsx`) with a `navigate.*` helper added in `lib/nav.ts`.

| Route | File | Ticket |
|---|---|---|
| `/login`, `/register`, `/forgot-password` | `src/app/(auth)/*.tsx` | EA-3 |
| `/home` | `src/app/home.tsx` | EA-44 |
| `/select-event` | `src/app/select-event.tsx` | EA-4 |
| `/dashboard` | `src/app/(tabs)/dashboard/index.tsx` | EA-5 |
| `/create-event` (modal), `/manage/edit-event` | `src/app/create-event.tsx`, `src/app/(tabs)/manage/edit-event.tsx` | EA-6 |
| `/sales` (hub) | `src/app/(tabs)/sales/index.tsx` | EA-2 |
| `/sales/ticket-scanners` | `src/app/(tabs)/sales/ticket-scanners.tsx` | EA-7 |
| `/sales/label-printing` | `src/app/(tabs)/sales/label-printing.tsx` | EA-8 |
| `/sales/ticket-type-sales` | `src/app/(tabs)/sales/ticket-type-sales.tsx` | EA-9 |
| `/sales/ticket-info` | `src/app/(tabs)/sales/ticket-info.tsx` | EA-10 |
| `/sales/presale` | `src/app/(tabs)/sales/presale.tsx` | EA-11 |
| `/sales/scan-statistics` | `src/app/(tabs)/sales/scan-statistics.tsx` | EA-12 |
| `/sales/merch` | `src/app/(tabs)/sales/merch/index.tsx` | EA-13 |
| `/analytics` (hub) | `src/app/(tabs)/analytics/index.tsx` | EA-2 |
| `/analytics/traffic-sources` | `src/app/(tabs)/analytics/traffic-sources.tsx` | EA-14 |
| `/analytics/referral-tracking` | `src/app/(tabs)/analytics/referral-tracking.tsx` | EA-15 |
| `/analytics/marketing-tracking` | `src/app/(tabs)/analytics/marketing-tracking.tsx` | EA-16 |
| `/manage` (hub) | `src/app/(tabs)/manage/index.tsx` | EA-2 |
| `/manage/form-management` | `src/app/(tabs)/manage/form-management.tsx` | EA-17 |
| `/manage/staff` | `src/app/(tabs)/manage/staff.tsx` | EA-18 |
| `/manage/venue-pricing` | `src/app/(tabs)/manage/venue-pricing.tsx` | EA-19 |
| `/manage/ticket-types` | `src/app/(tabs)/manage/ticket-types.tsx` | EA-20 |
| `/manage/vouchers` | `src/app/(tabs)/manage/vouchers.tsx` | EA-21 |
| `/manage/private-offers` | `src/app/(tabs)/manage/private-offers.tsx` | EA-22 |
| `/manage/tables` | `src/app/(tabs)/manage/tables.tsx` | EA-23 |
| `/manage/invoices` | `src/app/(tabs)/manage/invoices.tsx` | EA-24 |
| `/more` (hub) | `src/app/(tabs)/more/index.tsx` | EA-35 |
| `/more/overview` | `src/app/(tabs)/more/overview.tsx` | EA-25 |
| `/more/admin-events` | `src/app/(tabs)/more/admin-events/index.tsx` | EA-26 |
| `/more/fiscalizare` | `src/app/(tabs)/more/fiscalizare.tsx` | EA-27 |
| `/more/label-printers` | `src/app/(tabs)/more/label-printers.tsx` | EA-28 |
| `/more/stickers` | `src/app/(tabs)/more/stickers.tsx` | EA-29 |
| `/more/smartbill` | `src/app/(tabs)/more/smartbill.tsx` | EA-30 |
| `/more/team` | `src/app/(tabs)/more/team.tsx` | EA-31 |
| `/more/profile-traffic` | `src/app/(tabs)/more/profile-traffic.tsx` | EA-32 |
| `/more/message-subscribers` | `src/app/(tabs)/more/message-subscribers.tsx` | EA-33 |
| `/more/company-info` | `src/app/(tabs)/more/company-info.tsx` | EA-34 |
| `/more/settings` | `src/app/(tabs)/more/settings.tsx` | EA-35 |

## Gotchas

- `PressableScale` registers `Animated.View` with NativeWind (`cssInterop`); without it `className` on animated views is
  dropped on web.
- On web NativeWind runs in `class` mode; `useBootstrapTheme` resolves `system` to the real scheme there.
- Sibling Expo repos use Metro 8081. If the app shows `PlatformConstants could not be found`, a foreign Metro owns the
  port — stop it or start this one with `--port`.
