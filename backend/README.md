# TekBooks API

Express, MongoDB, private S3 storage and Resend. Configure credentials in `.env`; see `.env.example` for supported settings. From the repository root, `npm run dev` starts the API and mobile app.

Useful checks:

```powershell
npm run typecheck
npm run config:check
npm run db:check
npm run email:check
```

`email:check` sends to the configured notification inbox. `system:check` exercises connected services. Run `npm run test:features` at the repository root for isolated authentication, loading and report regressions.

Use `npm run compile` and `npm run start:prod` for the compiled server. Vercel imports `src/app.ts`; production validates remote MongoDB, private S3, email settings and secrets. Device binding applies in development unless an explicit non-production bypass is configured.

Approve a verified workspace with `npm run approve -- user@example.com`. See [API.md](API.md) for routes and [SECURITY.md](SECURITY.md) for access controls.
