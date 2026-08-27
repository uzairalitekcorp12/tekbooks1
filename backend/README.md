# TekBooks API v1.0.7

Node.js + Express + MongoDB API for TekBooks.

## Local run

From the project root, `npm run setup` installs dependencies. Start MongoDB with `docker compose up -d`, then run `npm run dev`.

v1.0.7 contains no bundled sample account. Create a workspace through the mobile signup flow. With Resend unset in development, email codes print to the API terminal. Approve the verified workspace with:

```powershell
npm --prefix backend run approve -- user@example.com
```

## Production services

- MongoDB for business data
- Local storage during development
- S3-compatible storage (AWS S3 / Cloudflare R2) for production files
- Resend for verification/reset/device/approval emails
- Expo push notification support for development/production builds

See the root `NEXT_PHASE_PLAN.md` before deployment.
