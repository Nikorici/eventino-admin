# Eventino Admin — Information Architecture

Source of truth for the sections: `~/eventino-frontend/components/SideBar/Sidebar.js` (branch `prod`), transcribed in
`src/lib/sections.ts` with the same labels, icons and visibility rules.

## Flow

```
launch ─► gate (src/app/index.tsx)
           ├─ no session ───────────► /login ── OTP | password | Google | Apple ──► /home
           │                            ├─ /register
           │                            └─ /forgot-password
           └─ session ──────────────► /home (all-events statistics)
                                        ├─ "Current event" row (when one is selected) ──► (tabs)
                                        └─ "Select an event" ──► /select-event ── tap an event ──► (tabs)
                                                                   back ──► /home
           (tabs)  Dashboard │ Sales │ Analytics │ Manage │ More   (no selected event → /home)
```

- The selected event (`eventId` + the organizer id it was picked under) is persisted (AsyncStorage → `localStorage` on
  web). Switching organizer account invalidates it, so the tabs guard sends the user back to `/home`.
- The Dashboard header title is the selected event name; tapping it opens `/select-event`. The Sales, Analytics and
  Manage hubs show the same event in a bar at the top, also tappable. More → Events → List of Events goes there too; More → Events → All events statistics opens `/home`.
- `/create-event` is a modal over everything (from `/select-event`).
- Every tab is its own Stack, so screens pushed from a hub keep the tab bar.

## Status

**designed** = the real screen is built on mock data; **stub** = the placeholder `StubScreen` until its ticket lands. A
screen agent flips its row to designed when it replaces the stub. Light/dark captures of every designed route:
`docs/screenshots/gallery/`.

| Route | Screen | Ticket | Status |
|---|---|---|---|
| `/login` | email OTP (+ new-account name step), password, Google, Apple | EA-3 | designed |
| `/register` | person / organization sign-up + email verification | EA-3 | designed |
| `/forgot-password` | email → code → new password | EA-3 | designed |
| `/home` | all-events statistics (period + currency sheets), current event, "Select an event" | EA-44 | designed |
| `/select-event` | compact event list (search, create, current event check) + organizer switcher | EA-4 | designed |
| `/create-event` | event form (modal) | EA-6 | designed |

## Tabs

| Tab | Root | Web origin | SF symbol | Android icon | Status |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` — event dashboard | `/dashboard/events/[id]` | `square.grid.2x2` | FontAwesome5 `th-large` | designed |
| Sales | `/sales` — hub | sidebar group **Sales & Scanning** | `ticket` | `ticket-alt` | designed |
| Analytics | `/analytics` — hub | sidebar group **Analytics** | `chart.bar` | `chart-bar` | designed |
| Manage | `/manage` — hub | sidebar group **Management** + "Edit event" from the event page | `slider.horizontal.3` | `sliders-h` | designed |
| More | `/more` — hub | account-level sidebar items + account | `ellipsis.circle` | `ellipsis-h` | designed |

## Web sidebar → app

Visibility uses the web's `useEventPermissions(event)` (`eventPermissions()` in `src/lib/sections.ts`). Event-scoped
items stay hidden until the selected event has loaded, exactly like the web.

### Event-scoped (selected event)

| Web sidebar item (label key) | Web path | Visible when | Tab | Route | Ticket | Status |
|---|---|---|---|---|---|---|
| — (event page) | `/dashboard/events/[id]` | manages the event | Dashboard | `/dashboard` | EA-5 | designed |
| Ticket Scanners | `/dashboard/events/[id]/ticket-scanners` | `canManageScanners` | Sales | `/sales/ticket-scanners` | EA-7 | stub |
| Label Printing | `/dashboard/events/[id]/label-printing` | `canManageLabelPrinting` | Sales | `/sales/label-printing` | EA-8 | stub |
| Ticket Type Sales | `/dashboard/events/[id]/ticket-type-sales` | `hasFullAccess` | Sales | `/sales/ticket-type-sales` | EA-9 | stub |
| Ticket Purchase Info | `/dashboard/events/[id]/ticket-info` | `canViewAnalytics` | Sales | `/sales/ticket-info` | EA-10 | stub |
| Pre-sale | `/dashboard/events/[id]/presale` | `canViewBuyers && event.has_presale` | Sales | `/sales/presale` | EA-11 | stub |
| Ticket Scan Statistics | `/dashboard/events/[id]/ticket-scan-statistics` | `hasFullAccess` | Sales | `/sales/scan-statistics` | EA-12 | stub |
| Merch Store | `/dashboard/events/[id]/merch` (+ merch-orders, merch-products, merch-settings) | `hasFullAccess` | Sales | `/sales/merch` | EA-13 | stub |
| Traffic Sources | `/dashboard/events/[id]/traffic-sources` | `hasFullAccess` | Analytics | `/analytics/traffic-sources` | EA-14 | stub |
| Referral Tracking | `/dashboard/events/[id]/referral-tracking` | `hasFullAccess` | Analytics | `/analytics/referral-tracking` | EA-15 | stub |
| Marketing & Tracking | `/dashboard/events/[id]/marketing-tracking` | `hasFullAccess` | Analytics | `/analytics/marketing-tracking` | EA-16 | stub |
| Edit event (event page button) | `/create-event?isEdit=true&event_id=[id]` | `hasFullAccess` | Manage | `/manage/edit-event` | EA-6 | designed |
| Form Management | `/dashboard/events/[id]/form-management` | `hasFullAccess` | Manage | `/manage/form-management` | EA-17 | stub |
| Event Staff | `/dashboard/events/[id]/event-staff` | `hasFullAccess` | Manage | `/manage/staff` | EA-18 | stub |
| Venue & Pricing | `/dashboard/events/[id]/venue-pricing` | `hasFullAccess` | Manage | `/manage/venue-pricing` | EA-19 | stub |
| Ticket types | `/dashboard/events/[id]/ticket-types` | `hasFullAccess` | Manage | `/manage/ticket-types` | EA-20 | stub |
| Vouchers | `/dashboard/events/[id]/vouchers` | `hasFullAccess` | Manage | `/manage/vouchers` | EA-21 | stub |
| Private offers | `/dashboard/events/[id]/private-offers` | `hasFullAccess` | Manage | `/manage/private-offers` | EA-22 | stub |
| Tables | `/dashboard/events/[id]/tables` | `hasFullAccess` | Manage | `/manage/tables` | EA-23 | stub |
| Ticket sales invoices | `/dashboard/events/[id]/ticket-sales-invoices` | `hasFullAccess` | Manage | `/manage/invoices` | EA-24 | stub |

### Account-level (More tab, in web sidebar order)

| More section | Web sidebar item (label key) | Web path | Visible when | Route | Ticket | Status |
|---|---|---|---|---|---|---|
| (account card) | — avatar, switch account, log out | TopNavBar menu | always | `/more` | EA-35 | designed |
| (untitled) | Overview | `/dashboard` | always | `/more/overview` | EA-25 | stub |
| Events | All events statistics (the web dashboard's stats block) | `/dashboard` | always | `/home` | EA-44 | designed |
| Events | List of Events | `/dashboard/events` | always | `/select-event` | EA-4 | designed |
| Events | Admin Events | `/dashboard/admin-events` (+ `[id]/accounting`, `/dashboard/events-md`, `/dashboard/events-ro`) | `user.is_staff` | `/more/admin-events` | EA-26 | stub |
| Tickets | Fiscalizare Bilete | `/dashboard/fiscalizare-bilete` | always | `/more/fiscalizare` | EA-27 | stub |
| Tickets | Label Printers | `/dashboard/label-printers` | always | `/more/label-printers` | EA-28 | stub |
| Tickets | Stickers | `/dashboard/stickers` | `user.is_staff` or `GET /api/v1/tickets/scanned/?page=1` is not 401/403 | `/more/stickers` | EA-29 | stub |
| Tools | SmartBill Integration | `/dashboard/smartbill` | always | `/more/smartbill` | EA-30 | stub |
| Tools | My Team | `/dashboard/team` | always | `/more/team` | EA-31 | stub |
| Tools | Profile Traffic | `/dashboard/traffic-sources` | always | `/more/profile-traffic` | EA-32 | stub |
| Tools | Message Subscribers | `/dashboard/message-subscribers` | always | `/more/message-subscribers` | EA-33 | stub |
| Account | Company Information (not in the sidebar; page title) | `/dashboard/company-info` | always | `/more/company-info` | EA-34 | stub |
| Account | Settings | `/settings` | always | `/more/settings` | EA-35 | stub |

`/dashboard/events-md` and `/dashboard/events-ro` are staff-only regional tables (the web shows them to `is_staff` in the
event tour, `showCountryFilters`). eventino-mobile already folds both into its Admin Events screen as a Romania/Moldova
switch with the Romania decont archive (`admin-events.tsx`), so they live in `/more/admin-events` (EA-26).

"Tools" is the section title eventino-mobile already uses for the same four items (`organizer.tsx`); the web lists them
as top-level sidebar entries.

### Not ported

| Web page | Why |
|---|---|
| `/dashboard/networking` | not in the sidebar; Conecta has its own admin app |

## Screen anatomy

Every screen: `Screen edges={[]}` → absolute `GlassHeader` (title, back, optional right action) → scroll content padded
with `useScreenPadding()` → loading skeleton / empty state / error with retry / pull-to-refresh. Hubs list their
sections with the eventino-mobile "Tools" card (`ToolSection` + `ToolRow`: icon tile, label, chevron).
