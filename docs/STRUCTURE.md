# Eventino Admin — Information Architecture

Source of truth for the sections: `~/eventino-frontend/components/SideBar/Sidebar.js` (branch `prod`), transcribed in
`src/lib/sections.ts` with the same labels, icons and visibility rules.

## Flow

```
launch ─► gate (src/app/index.tsx)
           ├─ no session ───────────► /login ── OTP | password | Google | Apple ──► gate
           │                            ├─ /register
           │                            └─ /forgot-password
           ├─ no selected event ────► /select-event ── tap an event ──► /dashboard
           │   (or the stored event belongs to another organizer)
           └─ session + event ──────► (tabs)
                                        Dashboard │ Sales │ Analytics │ Manage │ More
```

- The selected event (`eventId` + the organizer id it was picked under) is persisted (AsyncStorage → `localStorage` on
  web). Switching organizer account invalidates it, so the gate sends the user back to `/select-event`.
- The Dashboard header title is the selected event name; tapping it opens `/select-event`. The Sales, Analytics and
  Manage hubs show the same event in a bar at the top, also tappable. More → Events → List of Events goes there too.
- `/create-event` is a modal over everything (from `/select-event`).
- Every tab is its own Stack, so screens pushed from a hub keep the tab bar.

## Tabs

| Tab | Root | Web origin | SF symbol | Android icon |
|---|---|---|---|---|
| Dashboard | `/dashboard` — event dashboard | `/dashboard/events/[id]` | `square.grid.2x2` | FontAwesome5 `th-large` |
| Sales | `/sales` — hub | sidebar group **Sales & Scanning** | `ticket` | `ticket-alt` |
| Analytics | `/analytics` — hub | sidebar group **Analytics** | `chart.bar` | `chart-bar` |
| Manage | `/manage` — hub | sidebar group **Management** + "Edit event" from the event page | `slider.horizontal.3` | `sliders-h` |
| More | `/more` — hub | account-level sidebar items + account | `ellipsis.circle` | `ellipsis-h` |

## Web sidebar → app

Visibility uses the web's `useEventPermissions(event)` (`eventPermissions()` in `src/lib/sections.ts`). Event-scoped
items stay hidden until the selected event has loaded, exactly like the web.

### Event-scoped (selected event)

| Web sidebar item (label key) | Web path | Visible when | Tab | Route | Ticket |
|---|---|---|---|---|---|
| — (event page) | `/dashboard/events/[id]` | manages the event | Dashboard | `/dashboard` | EA-5 |
| Ticket Scanners | `/dashboard/events/[id]/ticket-scanners` | `canManageScanners` | Sales | `/sales/ticket-scanners` | EA-7 |
| Label Printing | `/dashboard/events/[id]/label-printing` | `canManageLabelPrinting` | Sales | `/sales/label-printing` | EA-8 |
| Ticket Type Sales | `/dashboard/events/[id]/ticket-type-sales` | `hasFullAccess` | Sales | `/sales/ticket-type-sales` | EA-9 |
| Ticket Purchase Info | `/dashboard/events/[id]/ticket-info` | `canViewAnalytics` | Sales | `/sales/ticket-info` | EA-10 |
| Pre-sale | `/dashboard/events/[id]/presale` | `canViewBuyers && event.has_presale` | Sales | `/sales/presale` | EA-11 |
| Ticket Scan Statistics | `/dashboard/events/[id]/ticket-scan-statistics` | `hasFullAccess` | Sales | `/sales/scan-statistics` | EA-12 |
| Merch Store | `/dashboard/events/[id]/merch` (+ merch-orders, merch-products, merch-settings) | `hasFullAccess` | Sales | `/sales/merch` | EA-13 |
| Traffic Sources | `/dashboard/events/[id]/traffic-sources` | `hasFullAccess` | Analytics | `/analytics/traffic-sources` | EA-14 |
| Referral Tracking | `/dashboard/events/[id]/referral-tracking` | `hasFullAccess` | Analytics | `/analytics/referral-tracking` | EA-15 |
| Marketing & Tracking | `/dashboard/events/[id]/marketing-tracking` | `hasFullAccess` | Analytics | `/analytics/marketing-tracking` | EA-16 |
| Edit event (event page button) | `/create-event?isEdit=true&event_id=[id]` | `hasFullAccess` | Manage | `/manage/edit-event` | EA-6 |
| Form Management | `/dashboard/events/[id]/form-management` | `hasFullAccess` | Manage | `/manage/form-management` | EA-17 |
| Event Staff | `/dashboard/events/[id]/event-staff` | `hasFullAccess` | Manage | `/manage/staff` | EA-18 |
| Venue & Pricing | `/dashboard/events/[id]/venue-pricing` | `hasFullAccess` | Manage | `/manage/venue-pricing` | EA-19 |
| Ticket types | `/dashboard/events/[id]/ticket-types` | `hasFullAccess` | Manage | `/manage/ticket-types` | EA-20 |
| Vouchers | `/dashboard/events/[id]/vouchers` | `hasFullAccess` | Manage | `/manage/vouchers` | EA-21 |
| Private offers | `/dashboard/events/[id]/private-offers` | `hasFullAccess` | Manage | `/manage/private-offers` | EA-22 |
| Tables | `/dashboard/events/[id]/tables` | `hasFullAccess` | Manage | `/manage/tables` | EA-23 |
| Ticket sales invoices | `/dashboard/events/[id]/ticket-sales-invoices` | `hasFullAccess` | Manage | `/manage/invoices` | EA-24 |

### Account-level (More tab, in web sidebar order)

| More section | Web sidebar item (label key) | Web path | Visible when | Route | Ticket |
|---|---|---|---|---|---|
| (account card) | — avatar, switch account, log out | TopNavBar menu | always | `/more` | EA-35 |
| (untitled) | Overview | `/dashboard` | always | `/more/overview` | EA-25 |
| Events | List of Events | `/dashboard/events` | always | `/select-event` | EA-4 |
| Events | Admin Events | `/dashboard/admin-events` (+ `[id]/accounting`) | `user.is_staff` | `/more/admin-events` | EA-26 |
| Tickets | Fiscalizare Bilete | `/dashboard/fiscalizare-bilete` | always | `/more/fiscalizare` | EA-27 |
| Tickets | Label Printers | `/dashboard/label-printers` | always | `/more/label-printers` | EA-28 |
| Tickets | Stickers | `/dashboard/stickers` | `user.is_staff` or `GET /api/v1/tickets/scanned/?page=1` is not 401/403 | `/more/stickers` | EA-29 |
| Tools | SmartBill Integration | `/dashboard/smartbill` | always | `/more/smartbill` | EA-30 |
| Tools | My Team | `/dashboard/team` | always | `/more/team` | EA-31 |
| Tools | Profile Traffic | `/dashboard/traffic-sources` | always | `/more/profile-traffic` | EA-32 |
| Tools | Message Subscribers | `/dashboard/message-subscribers` | always | `/more/message-subscribers` | EA-33 |
| Account | Company Information (not in the sidebar; page title) | `/dashboard/company-info` | always | `/more/company-info` | EA-34 |
| Account | Settings | `/settings` | always | `/more/settings` | EA-35 |

"Tools" is the section title eventino-mobile already uses for the same four items (`organizer.tsx`); the web lists them
as top-level sidebar entries.

### Not ported

| Web page | Why |
|---|---|
| `/dashboard/events-md`, `/dashboard/events-ro` | not in the sidebar (regional admin views reached from Admin Events; EA-26 decides) |
| `/dashboard/networking` | not in the sidebar; Conecta has its own admin app |

## Screen anatomy

Every screen: `Screen edges={[]}` → absolute `GlassHeader` (title, back, optional right action) → scroll content padded
with `useScreenPadding()` → loading skeleton / empty state / error with retry / pull-to-refresh. Hubs list their
sections with the eventino-mobile "Tools" card (`ToolSection` + `ToolRow`: icon tile, label, chevron).
