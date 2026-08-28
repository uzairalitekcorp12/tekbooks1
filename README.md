# TekBooks

TekBooks is an Expo Android bookkeeping app with an Express/MongoDB backend.

- Local development: MongoDB in Docker and local attachment storage.
- Production: Vercel Express Function, MongoDB Atlas, private Amazon S3, and Resend.
- Android: EAS `preview` builds an installable APK; `production` builds a Play Store AAB.

Without a custom email domain, Vercel can run in explicit Resend test mode. All app features work, but Resend email delivery and email signup are limited to the Resend account address until a domain is verified.

## Quick start

```powershell
npm run setup
npm run configure:local
npm run system:check -- --email=YOUR_RESEND_TEST_EMAIL
npm run dev
```

This recommended path uses Atlas, private S3, and Resend locally. Docker plus `npm run db:start` remains an optional local-MongoDB fallback.

Useful checks:

```powershell
npm run typecheck
npm run db:check
npm --prefix backend run config:check
npm run verify
```

`ECONNREFUSED 127.0.0.1:27017` means the local MongoDB service is not running; it is unrelated to the phone's Wi-Fi address. Start Docker Desktop before `npm run db:start`, start a separately installed MongoDB service, or put a MongoDB Atlas URI in `backend/.env`.

Local Expo development follows the active Wi-Fi address when `npm run dev` starts. An installed preview/production APK must instead contain a stable public HTTPS backend URL, so it works on any Wi-Fi or mobile data without the development PC.

Start with [EASY_SETUP.md](./EASY_SETUP.md). [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) is the expanded reference.
