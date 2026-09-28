# TekBooks

Expo bookkeeping app with an Express/MongoDB API, private S3 attachments and Resend emails.

## Run locally

```powershell
npm run setup
npm run configure:local
npm run db:check
npm run dev
```

Use `backend/.env` for MongoDB, storage and Resend credentials. `mobile/.env` contains the public API URL. Development starts the API and Expo together and updates the phone's LAN address automatically. Use `npm run dev:tunnel` when a LAN connection is unavailable.

## Verify

```powershell
npm run verify
npm run test:features
npm --prefix backend run email:check
```

The feature checks use isolated sample records and mocked delivery to verify loading states, request sharing, device approval, email verification, password resets and PDF/Excel exports. The email check sends a real test email to the configured inbox. `npm run system:check` also checks connected database/storage services.

Set `LOGIN_NOTIFICATION_EMAIL` to the inbox for your configured `LOGIN_USERNAME` / `LOGIN_USER_EMAIL`. Resend's testing sender delivers only to the Resend account inbox; production test mode also requires `RESEND_TEST_MODE=true` and `RESEND_TEST_RECIPIENT`. Use a verified sending domain to email other users.

New devices require a 10-minute email code or approval through **Workspace → Device requests** on the registered phone. Device approval is enabled by default in development, including Expo Go. Native push requires an installed build; Expo Go can use the approval panel and email instead.

Build Android with `npm run build:apk` or `npm run build:aab`. Installed builds need a stable public HTTPS API URL. The backend's [API reference](backend/API.md) and [security notes](backend/SECURITY.md) describe the supported routes and controls.
