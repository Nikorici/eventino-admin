# EA-5 — Event dashboard (`/dashboard`)

Web source: `~/eventino-frontend/pages/dashboard/events/[id].js` (branch `prod`) and the components it renders.
Design source: `~/eventino-mobile/src/app/dashboard-event/[id].tsx` + `src/components/dashboard/*`.
Permissions: `eventPermissions(event, user)` (`src/lib/sections.ts`) = web `useEventPermissions`.

## 1. Event header (`#nextstep-event-overview`)

| Web | App |
|---|---|
| `event.title`, "Here is the information about your event" | event card: poster, name, status pill, subtitle |
| "Location:" `event.country` · "Date:" `start_date` (`d MMM yyyy`) | same two labelled fields |
| (sidebar "List of Events") | switch icon on the card + header title → `/select-event` |
| Tour button (nextstep, sidebar steps) | **not ported** (points at web sidebar anchors) |
| Actions shown when `isEventOwner \|\| user.is_staff \|\| canManageTickets` | same gate |
| "Edit event" (`hasFullAccess`) → `/create-event?isEdit=true&event_id=` | `navigate.editEvent` (EA-6) |
| "Download settlement PDF" | "Settlement PDF" → share sheet |
| "Download act predare-primire" | "Handover document" → share sheet, then the web success/failure toast |
| "Release Ticket" → modal "Release Ticket Manually" | sheet: first/last name, email, phone (optional), ticket types sorted by price, quantity, zone (venues), seats (active seat map), one POST per type, partial-failure toast |
| "Cancel Event" (`user.is_staff`) | `CancelEventSheet` (danger button; "Event cancelled" when already cancelled) |

## 2. Statistics (`canViewAnalytics`) — `NumericStats`

- Title "Statistics", interval All Time / This Week / Previous Week.
- Cards: Total Users, Total Revenue (per currency), Tickets Sold, Total Received (+ invoice part, "sum without invoices"),
  Total Tickets, Paid Tickets, Free Tickets (`manual_tickets_count`).
- Cancelled event: no fetch, every value "-".
- App: shared `DashboardStatsSection` (copied from eventino-mobile; also shows Scanned / Not Scanned cards).

## 3. Event Analytics (`canViewAnalytics`) — `Analytics`

- Month navigator, revenue area chart, "vs previous month", mini series Total Users / Tickets Sold / Favorites.
- App: chart inside `DashboardStatsSection` (Month/Week/Day modes from eventino-mobile), no lifecycle clamp (web shows full months).
- Cancelled event: the web still renders `Analytics`, so the app shows the chart (`AnalyticsChart`) under the "-" cards.

## 4. Orders & customers (`#nextstep-event-orders`)

- Cancelled: banner "Event cancelled, no orders and customers."
- Tabs (chips): Event buyers (`canViewBuyers`), Pending orders, Bank transfers, Persoane juridice, Persoane fizice (`canManageOrders`).
  Default tab buyers. Per-Ticket Factura (event 1296) and Attendee Names (event 1284) are hard-coded to one event: not ported.

### 4a. Event buyers — `BuyerList` + `BuyerTable`
- "List of Customers"; Export Excel; settlement month + Export Settlement; period All/Monthly/Weekly/Daily.
- Search (name, email, phone, order); attendance All / Scanned / Not Scanned.
- Row: no., attendee (avatar/initials, name, email), ticket type, tickets, amount (`(handled by organizer)` for INVOICE),
  date, attendance status, coupon, insights (`Q&A: x/y`, `Attendees: n`), participants preview (first two, ` | `),
  "Ticket" PDF download (buyers only).
- Load More (`N remaining`); empty "No customers found for the selected time period." / "No results match your search".
- Row tap → detail: Attendance x/y, Lifetime Value, Last Seen, Order Summary, Questionnaire, Participants.

### 4b. Pending orders — `PendingOrders`
- Title + "Users who initiated checkout but have not completed payment"; search name/email/order id.
- Row: #id, customer, email, ticket names, total, payment method badge, date; INVOICE → "Mark as Paid" (confirm,
  toast variant on `factura_sent`). Footer "Total pending orders: n". Row detail folded into the card.

### 4c. Bank transfers / Persoane juridice / Persoane fizice — `FacturaOrders` / `FacturaIndividualOrders`
- Bank transfers: `factura-orders?customer_type=all`; juridice/fizice: `factura-individual-orders?customer_type=`.
- Titles/subtitles per type, search, row: No. (`invoice_serial`), #id, customer, email, tickets, total, method, status,
  date, SPV deadline badge (5 days, urgent ≤2, Downloaded), Download PDF / SPV / SmartBill-Oblio / FGO.
- Footer count. Serial edit (Persoane juridice of event 1471, as the web): pencil next to "No." → sheet ported from
  eventino-mobile `event-invoices/[id].tsx` (`POST /api/v1/tickets/edit-invoice-serial/`).

## 5. Free ticket requests (`canManageOrders && free_ticket_approval_enabled && !is_cancelled`)

- "Pending Free Ticket Requests" + subtitle; rows: name, email, submission date, coupon code, ticket pills;
  Send Ticket / Reject with confirmation; removed on success. Event-id special cases (984/1284/1473/1550): not ported.

## App adaptations (same data, phone layout)

- Web tables become row cards; the pending-order detail modal is folded into its card.
- Repeated ticket names are grouped (`4 × Acces o zi`).
- Factura downloads are pills `PDF · SPV · SmartBill/Oblio · FGO` after a "Factura" label; the web button copy
  ("Download PDF", …) is the accessibility label.
- Web `window.confirm` → `Alert.alert` on device (`window.confirm` on web), toasts as in eventino-mobile.

## States

Event loading → skeleton; event error → EmptyState + retry; every panel: skeleton, empty text, error + retry;
pull-to-refresh refetches event, stats, chart and the open panel.

## Endpoints

| Method | URL | Web source |
|---|---|---|
| GET | `/api/v1/events/:id/` | `api/eventApi.js` getEvent |
| POST | `/api/v1/statistics/get-recent-stats/` | `api/eventApi.js` fetchEventStatistics |
| POST | `/api/v1/statistics/get-stats-graph/` | `api/eventApi.js` fetchEventAnalytics |
| GET | `/api/v1/tickets/download-event-settlement/?event_id=` | `api/ticketApi.js` |
| GET | `/api/v1/tickets/download-act-predare-primire/?event_id=` | `api/ticketApi.js` |
| POST | `/api/v1/tickets/:eventId/release-manual-ticket/` | `components/TicketRelease/TicketRelease.jsx` |
| POST | `/api/v1/events/:id/cancel-event/` | `components/CancelEvent/CancelEvent.jsx` |
| POST | `/api/v1/statistics/get-buyers-list/` | `components/BuyerTable/BuyerTable.js` |
| POST | `/api/v1/statistics/get-tickets-export/` | `components/MainDashBoard/BuyerList.js` |
| POST | `/api/v1/statistics/get-orders-settlement-export/` | `components/MainDashBoard/BuyerList.js` |
| GET | `/api/v1/tickets/download-order-ticket/?order_id=` | `components/BuyerTable/BuyerTable.js` |
| GET | `/api/v1/tickets/pending-orders/?event_id=` | `api/ticketOrderApi.js` |
| POST | `/api/v1/tickets/mark-invoice-as-paid/` | `api/ticketOrderApi.js` |
| GET | `/api/v1/tickets/factura-orders/?event_id=&customer_type=` | `api/ticketOrderApi.js` |
| GET | `/api/v1/tickets/factura-individual-orders/?event_id=&customer_type=` | `api/ticketOrderApi.js` |
| GET | `/api/v1/tickets/download-factura{,-xml,-saga-xml,-xlsx}/?order_id=` | `api/ticketOrderApi.js` |
| POST | `/api/v1/tickets/edit-invoice-serial/` | `api/ticketOrderApi.js` editInvoiceSerialNumber |
| GET | `/api/v1/tickets/free-ticket-requests/?event_id=` | `api/ticketOrderApi.js` |
| POST | `/api/v1/tickets/send-free-ticket/`, `/api/v1/tickets/reject-free-ticket/` | `api/ticketOrderApi.js` |
