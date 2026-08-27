# TekBooks API — Core Routes

All protected resource queries are scoped to the authenticated workspace/user.

## Authentication

- `POST /auth/signup` — create a pending workspace/user.
- `POST /auth/verify-email` — confirm email; workspace remains pending approval.
- `POST /auth/login` — login with device policy enforcement.
- `POST /auth/forgot-password` — request reset code.
- `POST /auth/reset-password` — verify reset code and replace password.
- Device request/approval endpoints support controlled replacement-device access.

## Business data

- `/dashboard` — summary/trend data.
- `/transactions` — income and expense ledger.
- `/parties` — customers and suppliers.
- `/invoices` — invoices and payment history.
- `/reports` — summaries, PDF reports and Excel reports.
- `/uploads` — receipt/document/company-logo upload abstraction.

## Workspace administration

Approval/management endpoints are server-side administrative capabilities protected by the configured admin secret. Do not embed administrative credentials in the mobile app. Replace this development/MVP mechanism with staff authentication before broad production rollout.
