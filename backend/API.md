# TekBooks API — Core Routes

All protected resource queries are scoped to the authenticated workspace/user.

## Health

- `GET /health` — process liveness without external dependency checks.
- `GET /ready` — verifies the MongoDB and storage connections.

## Authentication

- `POST /api/auth/signup` — create a pending workspace/user.
- `POST /api/auth/verify-email` — confirm email; workspace remains pending approval.
- `POST /api/auth/login` — log in with device policy enforcement.
- `POST /api/auth/forgot-password` — request a password-reset code.
- `POST /api/auth/reset-password` — verify the code and replace the password.
- Device request/approval endpoints support controlled replacement-device access.

## Business data

- `/api/dashboard` — summary and trend data.
- `/api/transactions` — income and expense ledger.
- `/api/parties` — customers and suppliers.
- `/api/invoices` — invoices and payment history.
- `/api/reports` — summaries, PDF reports, and Excel reports.

## Files

- `POST /api/uploads/presign` — authorize a direct private-S3 upload.
- `POST /api/uploads/complete` — verify the uploaded object's owner, size, type, and file signature.
- `POST /api/uploads` — local-disk multipart upload used during development.
- `GET /api/uploads/content` — authenticated local response or private-S3 redirect.
- `GET /media` — expiring application-signed media URL; redirects to a short-lived private S3 URL in production.

## Workspace administration

Approval/management endpoints are under `/api/admin` and protected by the configured admin secret. Never embed the admin credential in the APK. Replace this MVP mechanism with staff authentication and audit logging before broad production use.
