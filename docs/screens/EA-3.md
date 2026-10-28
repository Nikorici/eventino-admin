# EA-3 — Sign in, register, forgot password

Web sources (branch `prod`): `pages/login.js` → `containers/LogIn/LogIn.jsx`, `pages/signup.js` → `containers/SignUp/SignUp.jsx`,
`pages/forgot-password.js` → `containers/ForgotPassword/ForgotPassword.jsx` (+ `components/CountdownTimer`),
`pages/password-reset.js` → `containers/ResetPassword/ResetPassword.jsx`. Requests: `redux/auth/routes.js`, `redux/user/routes.js`.
Design source: eventino-mobile `src/app/(auth)/*`. Social pattern: admin-conecta-mobile `SocialSignIn.tsx`.

## Login — `/login` (`src/app/(auth)/login.tsx`)

| Web | App |
|---|---|
| Logo, "Let's sign in", "Welcome back. You've been missed" | same (mobile keys) |
| Password form: email, password, "Forgot your password?", Log In | password step (via "Use password instead") |
| Wrong credentials → toast "Incorrect password, please try again" | same toast |
| "Log In or Sign Up with Email Code" | email step is the default (mobile), "Use a code instead" goes back |
| OTP email + hint "Don't have an account? We'll create one for you automatically!" | email step + same hint |
| Send code → toast "Verification code sent…" / "Account created! Verification code sent…" | same toasts, by `user_exists` |
| OTP step: new account → "You're creating a new account. Tell us your name:" + first/last name | same, above the code boxes (web order) |
| 6 code boxes, paste support, inline error, Verify disabled until complete | `OtpBoxes` (one hidden input, OS autofill), inline error, Verify disabled until 6 digits + names |
| Resend Code | "Resend code" link |
| Back to Password Login | "Use a different email" |
| Success toast "Login successful!" / "Account created successfully! Welcome!" | same, then gate → `/select-event` |
| "Create an account" button | footer "Don't have an account? Sign Up" |
| or · Log In With Google · Log In With Apple | `SocialSignIn` (always both buttons) |
| Apple `apple_email_required` → modal: "Your email", explanation, email, Cancel/Continue, validation | `AppleEmailSheet` bottom sheet, same copy, validation and resend with the identity token |

## Register — `/register` (`src/app/(auth)/register.tsx`)

| Web | App |
|---|---|
| "Create an account" / "Create your account, it takes less than a minute" | same |
| Person / Organisation toggle | `SegmentedControl` |
| Person: first name, last name · Organisation: organisation name | same, first in the form (web order) |
| Email, password ("at least 8 characters") | same |
| Privacy Policy / Terms of Use checkboxes with links + inline errors | `CheckRow` + links open `www.eventino.co/privacy-policy`, `/terms-of-use`; same inline errors |
| "Organisation name is required!" | inline on the field |
| Backend `{status:400, message, errors}` → toast + field errors | toast `message`, `errors.<field>[0]` inline |
| Code modal: "Verify your email", email, 6 boxes, auto-submit at 6 digits | verify card, auto-submit at 6 digits, close = "Use a different email" |
| CountdownTimer: "Resend verification code (15)" | `ResendCode` 15 s cooldown |
| Verified → password login → "Account created successfully!" | same → gate → `/select-event` |
| or · Sign Up With Google / Apple (+ Apple email modal) | `SocialSignIn mode="register"` |
| "Already have an account? Log In" | same |

## Forgot / reset password — `/forgot-password` (`src/app/(auth)/forgot-password.tsx`)

| Web | App |
|---|---|
| Forgot page: email, "Reset password" | step 1 (mobile copy "Reset your password", "Send code") |
| Payload `device`, `location` (Geoapify IP lookup "Country, City"), `date` | same; location skipped while mocks are on |
| Non-200 body → toast `message: data` | same |
| Code modal, auto-submit, resend countdown (resend endpoint) | step 2, auto-submit, `ResendCode` on the resend endpoint |
| `/password-reset`: new + confirm, inline "Password must be at least 8 characters" / "Passwords do not match" | step 3, same inline errors |
| Backend `new_password[]`/`confirm_password[]` toasts, `detail` toast | same |
| Success: login with new password, "Password changed successfully!" | same → gate → `/select-event` |
| "Don't have an account? Sign up" | step 1 footer (plus mobile's "Remember your password? Log In") |

## Endpoints (all through `src/store/api/authApi.ts`)

| Method + URL | Web source |
|---|---|
| POST `/api/login/` | `redux/auth/routes.js` AUTH_LOGIN |
| POST `/api/v1/verifications/send_otp_login/` | SEND_OTP_LOGIN |
| POST `/api/v1/verifications/verify_otp_login/` | VERIFY_OTP_LOGIN |
| POST `/api/v1/verifications/resend_otp_login/` | RESEND_OTP_LOGIN |
| POST `/api/v1/auth/social-login` | AUTH_WITH_GOOGLE / AUTH_WITH_APPLE |
| POST `/api/register/` (multipart) | AUTH_REGISTER |
| POST `/api/v1/verifications/verify_email/` | VERIFY_EMAIL |
| POST `/api/v1/verifications/verify_email/resend_mail/` | RESEND_VERIFICATION_CODE |
| POST `/api/v1/users/user_login/` | SET_USER_AFTER_LOGIN (in `useAuth`) |
| POST `/api/v1/verifications/send_code_reset_password/` | `redux/user/routes.js` SEND_EMAIL_TO_RESET_PASSWORD |
| POST `/api/v1/verifications/verify_code_reset_password/` | VERIFY_EMAIL_FOR_RESET |
| POST `/api/v1/verifications/verify_code_reset_password/resend_mail/` | RESEND_VERIFICATION_CODE_FOR_RESET |
| POST `/api/password_reset/` | RESET_PASSWORD |

Social payloads follow eventino-mobile `docs/AUTH-CONTRACT.md`: Google `{provider:'google', access_token}` from
expo-auth-session, Apple `{provider:'apple.com', identity_token, platform:'ios', user}`. Google is unavailable in Expo
Go and Apple only works on iOS outside Expo Go; an unavailable button shows a toast instead of hiding (web shows both).

## Mock states (`src/mocks/auth.ts`)

- Known accounts: the three `core` organizers plus `ion.rusu@gmail.com`, `elena.munteanu@yahoo.com`. Any other email is a
  new account (OTP asks for the name; register succeeds; forgot password answers "User matching query does not exist.").
- Password `wrong-password` → 401 "No active account found…". Any other password signs in.
- Code `000000` → invalid code on OTP login, email verification and reset. Any other 6 digits passes.
- Apple without an email → `apple_email_required` (the mock Apple payload never has one, so the sheet always opens).
- Register: existing email → "User with this email already exists"; `*.con` → domain error; password under 8 → field error.

## Not ported

- Post-login redirects (`redirect_to_tickets`, checkout, `redirect_to_event`, profile verification `set_verified`):
  buyer flows; the organizer app always goes to the gate → `/select-event`.
- PWA install popup (`AppVersionPopup`), Firebase redirect loader, `saveUserInputData` form persistence across pages.
- "Go to Profile" button on the reset page (no profile screen in this app).
- Inline `email`/`password` field errors on password login: `/api/login/` (SimpleJWT) only returns field arrays for
  empty fields, which the app blocks before sending; `detail` becomes the "Incorrect password, please try again" toast.
- Copy: where eventino-mobile already has a translated key for the same action it is kept ("Continue with email" for
  "Send Verification Code", "Verify" for "Verify & Log In", "Resend code" for "Resend Code"/"Resend verification code",
  "Send code" for "Reset password", "Reset your password" for "Forgot password?", "Create a new password" /
  "New password" / "Confirm password" / "Reset password" for the web's "Enter the new password" / "New Password" /
  "Confirm New Password" / "Change Password"). The web's raw resend toasts ("Code Resent successfully!") are "Code sent".
