# TekBooks API v1.0.11

Node.js, Express, MongoDB, private S3 storage, and Resend API for TekBooks.

## Local run

From the repository root:

```powershell
npm run setup
npm run configure:local
npm run system:check -- --email=YOUR_RESEND_TEST_EMAIL
npm run dev
```

The recommended setup uses Atlas, private S3, and Resend locally, so it works after changing Wi-Fi and does not require a local MongoDB service. Docker/local MongoDB and local files remain supported as a fallback. Create a workspace through the mobile signup flow, then approve the verified user with:

If `/ready` reports `ECONNREFUSED 127.0.0.1:27017`, Docker Desktop/MongoDB is not running. The API keeps `/health` online and retries database initialization, but database routes remain unavailable until MongoDB starts. Use `npm run db:check` to verify it.

```powershell
npm --prefix backend run approve -- user@example.com
```

## Production architecture

- Vercel detects the pinned Express framework and imports `src/app.ts` as one Express Function.
- MongoDB Atlas stores application data; the Mongoose pool is reused across warm invocations.
- The APK uploads directly to a private S3 bucket with a five-minute presigned PUT.
- Private S3 downloads use short-lived presigned redirects, avoiding Vercel's 4.5 MB payload limit.
- Generated invoice PDFs and report PDF/XLSX files also use private S3 redirects and age out after 24 hours on the user's next export.
- Resend sends verification, password reset, device authorization, and approval emails.
- Strict production configuration fails startup when development secrets, local MongoDB, local storage, or Expo Go bypass are used. `onboarding@resend.dev` is accepted only when explicit one-recipient Resend test mode is configured.

Run `npm run config:check` to validate configuration without connecting to services. Run `npm run system:check -- --email=you@example.com` to exercise MongoDB, S3 upload/read/delete, invoice PDF generation, and Resend delivery.

See [EASY_SETUP.md](../EASY_SETUP.md) for the beginner setup and [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for the expanded reference.
