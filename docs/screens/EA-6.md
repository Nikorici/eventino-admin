# EA-6 — Create and edit event form

Routes `/create-event` (modal, `src/app/create-event.tsx`) and `/manage/edit-event` (`src/app/(tabs)/manage/edit-event.tsx`,
the selected event). Web source: `pages/create-event.js` → `containers/CreateEvent/CreateEvent.jsx` (one page for both;
edit = `/create-event?isEdit=true&event_id=[id]` from the event dashboard "Edit event" button). Helpers:
`helpers/eventFormTickets.js`, `helpers/quantityDiscounts.js`, `components/QuantityDiscountTiersEditor`,
`components/MediaGallery`, `components/LocationAutocomplete`, `components/Map`, `components/OrganizerSwitcher`.

Design source: eventino-mobile `src/app/create-event.tsx`, `src/app/edit-event/[id].tsx`, `components/events/EventForm.tsx`
(+ QuestionsBuilder, TimelineEditor, OrganizerPicker, LocationAutocompleteField), `lib/eventFormBody.ts`, `lib/places.ts`.
The extended form lives in `src/components/eventForm/`.

## Sections in web order

| # | Web | Mobile | Status |
|---|---|---|---|
| 1 | Back button + "Create Event" | GlassHeader "Create an event" / "Edit event", back | done |
| 2 | Gate: email not verified → "You should have verified account to be able to create events." + Back / Verify | EmptyState + Back | done (Verify: no profile screen) |
| 3 | Event media: up to 6 images + 1 video, reorder, first = cover, PNG/JPG/WEBP caption, 16:9 hint | MediaStrip (expo-image-picker, arrows to reorder, Cover badge) + 16:9 hint | done |
| 4 | `OrganizerSwitcher` above the title | `OrganizerSwitcher` in the header right slot (create only, like `/select-event`) | done |
| 5 | Title "Event Name" | large title input | done |
| 6 | Company (SRL) select, only when the account has >1 company | chips: "— use default —" + companies | done |
| 7 | Acting on behalf of (create only, when delegators exist): Myself + delegators | chips | done |
| 8 | Publish as organizer (create only, superuser): select/change/remove an organization (search modal) | card + search sheet | done |
| 9 | Description "Add Description" | multiline GlassInput | done |
| 10 | Start / End date + time (default today now → +1 h; changing the start date copies it to the end date) | date + time pickers, same defaults | done |
| 11 | Time is TBA toggle | ToggleRow | done |
| 12 | Event Location: Physical / Virtual toggle | LocationTypeToggle | done |
| 12a | Physical: Location TBA toggle, Google Places autocomplete (city when TBA), "Attendees will see: TBA City, Country" | ToggleRow + LocationAutocompleteField + chip | done |
| 12b | Virtual: meeting link (Zoom / Google Meet detection, helper text), optional physical location "for better discoverability" | link input + detected badge + optional autocomplete | done |
| 12c | Map with marker when an address is set; click moves the pin | react-native-maps preview, tap moves the pin (web build: hidden) | done |
| 13 | Event timeline: add / remove items (title, description, start/end time) | TimelineEditor | done |
| 14 | Category select "Select category:" | CategorySelect sheet with search | done |
| 15 | Coupons: code, discount %, max uses (empty = unlimited), usage `x / max` in edit, delete (saved coupons are deactivated) | coupon cards + usage line + active toggle | done |
| 16 | Event Options *: tickets list (name, Table, event-day and quantity-discount badges, price/Free) + ticket modal | inline ticket cards | done |
| 16a | Ticket: name*, comment, limit, QR codes per ticket (Special Offer), visibility, table ticket, show remaining, event day (multi-day), quantity discounts, sale period, price + currency, free | all fields on the ticket card | done |
| 16b | Edit: existing ticket price locked + notice; existing tickets of a paid event cannot be deleted | same | done |
| 16c | No ticket → "Bilet General" free ticket is sent | form starts with one ticket | done (by design) |
| 17 | Privacy dropdown Public / Personal / Private with descriptions | SegmentedControl + the web description of the selected type | done |
| 18 | Registration questions: list + modal (text, description, 7 types, options, per-option logic: continue / skip to / end / show message, required) | QuestionsBuilder + logic editor per option | done |
| 19 | Event Organizers: add (search modal, top organizations first), remove | OrganizerPicker | done |
| 20 | Payment gate before submit (paid tickets): MD → MAIB contract; RON → NETOPIA contract; other non-MDL → Stripe connect | PaymentSetupSheet (contract form + terms / Connect Stripe) | done |
| 21 | Edit only: Save as Draft toggle (disabled for non-organizations) | ToggleRow | done |
| 22 | Submit "Create Event" / "Save Event", loading state, error toasts | sticky GlassButton (create) / inline button at the end (edit, clears the tab bar); toast with the backend message (HTML error pages skipped), else the web's per-status text (413 / 401 / 403 / 408 / 502 / 503 / 504 / 5xx / network) | done |
| 23 | Success → event page | create: selects the new event → `/dashboard`; edit: → `/dashboard` | done |

## Validation (web `submitCreateEvent`)

At least one image; title; description; start date (+ time unless TBA); end date (+ time unless TBA); end after start;
physical: address unless TBA, country when TBA; virtual: link required and valid URL; category; ticket name; ticket
limit is a whole number; sale end after sale start; quantity discount tiers (min 2 tickets, 1–99 %, unique, max 10).

## States

- Create: categories loading → chip skeleton; submit loading; payment sheet; error toast.
- Edit: event loading → skeleton; error → EmptyState + retry; pull-to-refresh not used (a refetch would reset unsaved edits,
  the web has none either).

## Endpoints

| Method | URL | Web source | Use |
|---|---|---|---|
| GET | `/api/v1/categories/` | `redux/events` getCategories | categories |
| POST | `/api/v1/events/` (multipart) | `redux/events` createEvent | create |
| PATCH | `/api/v1/events/:id/` (multipart, `replace_images`, `existing_image_ids`, `media_order`) | `redux/events` editEvent | edit |
| GET | `/api/v1/events/:id/` | `redux/events` getEvent | edit prefill |
| GET | `/api/v1/event_coupons/by-event/?event_id=` | `api/eventApi.js` fetchEventCoupons | edit coupons (falls back to `event.coupons`) |
| GET | `/api/v1/companies/` | `redux/multiOrganizer` fetchCompanies | Company (SRL) |
| GET | `/api/v1/account-delegates/my-delegators/` | `api/accountDelegateApi.js` getMyDelegators | Acting on behalf of |
| GET | `/api/v1/users/organizations/?query=&page=` | `redux/user` getOrganizations | owner + organizer search |
| GET | `/api/v1/users/stripe_verified/` | `api/userApi.js` getStripeVerification | payment gate |
| POST | `/api/v1/users/stripe_connect/` | `api/userApi.js` getStripeConnectUrl | Connect Stripe |
| POST | `/api/v1/users/sign_contract/` | `api/userApi.js` signContract | MAIB / NETOPIA contract |

Create, update, delete and cancel invalidate the `Event` tag, which the organizer event list (`/select-event`) provides, so
a new or renamed event shows there without a manual refresh. Saving the edit form also invalidates the event's `Coupons`
tag, so the vouchers screen and the next edit read the saved coupons.

Mocks (`src/mocks/event-form.ts`): categories, create (adds a real `MockEvent`, so it shows in `/select-event`), edit
(updates the event and its detail), organizations, Stripe, contract. Coupons by event and companies are owned by EA-21 /
EA-34; until they answer, the form falls back to `event.coupons` and hides the company picker.

## Not ported

- Google reverse geocoding on submit (web rewrites region/country/address from lat/long with the Maps Geocoding API);
  the app sends what Places details returned, like eventino-mobile.
- Drag-and-drop media reorder: arrows instead (eventino-mobile).
- Gate "Verify" button: the app has no profile verification screen; only Back is shown.
- eventino-mobile's "Delete event" header button: the web form defines `submitDeleteEvent` but never renders it, so it is
  left out.
