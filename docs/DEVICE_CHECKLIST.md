# Device checklist (Expo Go, real API)

Things the web build cannot prove. `.env`: `EXPO_PUBLIC_USE_MOCKS=false`, `EXPO_PUBLIC_API_URL` set, then
`npx expo start -c` and open the project in Expo Go (SDK 58) on an iPhone and an Android phone.

1. Login with email OTP: the code arrives by email, Verify lands on Home. Kill and reopen the app: still signed in.
2. Password login, then wait 20+ minutes in the app and pull to refresh: data reloads (token refresh), no logout.
3. iPhone: Continue with Apple, both "Share my email" and "Hide my email". Lands on Home.
4. Google button: hidden in Expo Go is expected. Note whether it shows at all.
5. Home: change the currency sheet (multi-currency account) and the period sheet. Totals change, no red error.
6. Select an event, then Dashboard: Settlement PDF and Handover document open the share sheet; save to Files works.
7. Merch → Orders → Export Excel and Pre-sale export: the share sheet opens with an .xlsx that opens in Numbers/Sheets.
8. Create event: pick images from the gallery (image picker permission prompt), reorder, set cover.
9. Create/edit event: native date and time pickers for start/end, on both platforms. Picked values save correctly.
10. Create/edit event: location search and the map pin. Then Vouchers: "Valid from/until" date pickers.
11. Copy link (private offers, tables, referral promoters, ticket types embed): paste in Notes, the URL is right.
12. Delete/remove actions (voucher, ticket type, scanner, staff): the native confirm dialog shows, Cancel keeps the row.
13. Pre-sale on a live pre-sale event: new registrations appear without refreshing (realtime stream).
14. Stickers (staff account): a new scan shows up live; Print sticker works with a paired printer.
15. Label layout editor: pick a logo image; the preview updates.
16. Haptics: taps on buttons, chips, toggles and destructive confirms give feedback (turn on system haptics first).
17. iOS 26: tab bar and glass headers render as Liquid Glass. Older iOS: blur. Android: translucent fill, nothing broken.
18. Dark mode: switch the phone theme with the app open; every screen follows, text stays readable.
19. Keyboard: in long forms (event form, ticket type sheet, voucher sheet) the focused field is never covered.
20. Pull to refresh on Home, Dashboard, a Sales screen and a Manage screen: the spinner shows and stops.
21. Switch account (organizer switcher): the selected event resets and Home shows the other organizer's totals.
22. Push notifications: none expected (not installed in Expo Go). Nothing should ask for notification permission.
23. Log out from More: back to the login screen; reopening the app stays logged out.
