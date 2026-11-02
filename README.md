# Eventino Admin

The Eventino organizer dashboard (`eventino-frontend` → `pages/dashboard/**`, `pages/create-event.js`) as a phone app.
Expo SDK 58, runs in **Expo Go**. It talks to the real Eventino API; a mock layer (`EXPO_PUBLIC_USE_MOCKS=true`) is
there for UI work without a backend.

Agent and code conventions: `CLAUDE.md`. Information architecture and per-route status: `docs/STRUCTURE.md`.
Screenshots of every designed route, light and dark: `docs/screenshots/gallery/`.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Play Store. It must be the build for **SDK 58** (the current store version).
2. Phone and laptop on the same Wi-Fi.
3. In a terminal:

```bash
cd ~/eventino-admin
npm install
cp -n .env.example .env     # only the first time; set EXPO_PUBLIC_USE_MOCKS=true for the mock login below
npx expo start
```

4. Scan the QR code: iPhone with the Camera app, Android from inside Expo Go ("Scan QR code").
5. Sign in with your organizer account. With mocks on, the mock login works like this:
   - type **any email**, tap **Continue with email**;
   - type **any 6-digit code** and tap **Verify** (`000000` is the one code that fails, to show the invalid-code error);
   - an email that is not a fixture account also asks for a first and last name, like the real "new account" step;
     use `andrei.ciobanu@sunsetevents.md` to skip it;
   - **Use password instead** works with any email and any password (`wrong-password` shows the error). Google signs
     in straight away; Apple first asks for an email, because the mock Apple account hides it (the real "Apple didn't
     share an email" case).
6. Pick an event (**Festivalul Vinului**, 4101, has the most data). The tabs are Dashboard, Sales, Analytics, Manage and
   More. Tap the event name at the top of the Dashboard to switch events.

Any email signs in as **Andrei Ciobanu / Sunset Events**, except the two linked organizer emails
(`office@jazzinchisinau.md`, `contact@clujlive.ro`), which sign in as those organizers. Mock changes (edits, new events)
live in memory until the app reloads.

If the app shows `PlatformConstants could not be found`, another project's Metro is holding port 8081. Stop it, or run
`npx expo start --port 8098`. If the phone can't reach the laptop (guest Wi-Fi, VPN), use `npx expo start --tunnel`.

## Other commands

```bash
npx expo start --web      # same app in the browser
npx tsc --noEmit          # typecheck
npx expo lint             # lint
npx expo-doctor           # dependency checks
npx jest                  # unit tests
```

## Real API

The default (`EXPO_PUBLIC_USE_MOCKS=false` or unset). Requests go to `EXPO_PUBLIC_API_URL` (`https://api.eventino.co`)
with the same endpoints the web uses. After changing `.env`, restart with `npx expo start -c`. Things only a phone can
check: `docs/DEVICE_CHECKLIST.md`.
