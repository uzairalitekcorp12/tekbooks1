# TekBooks Security Design

## Implemented controls

- Passwords hashed with bcrypt cost 12.
- JWT bearer authentication; protected APIs also require account status `APPROVED`.
- Signup/email verification is separate from organization approval.
- Android installed builds bind an account to `Settings.Secure.ANDROID_ID` via `expo-application`.
- A different device cannot simply reuse the password: it needs an email OTP or approval from the currently signed-in device.
- Expo Go may bypass device binding **only** when backend is non-production and `ALLOW_EXPO_GO_DEVICE_BYPASS=true`.
- Repeated bad passwords increment a counter; 8 failures cause a temporary 15-minute account lock.
- Global, auth and sensitive-operation rate limiters reduce brute force and submission flooding.
- `Idempotency-Key` records prevent duplicate POST/PUT/PATCH effects caused by retries/double taps.
- JSON request size limit: 1 MB.
- Attachments: JPEG/PNG/WebP/PDF only, size capped by `MAX_UPLOAD_MB` (default 10 MB). S3 uploads are completed only after the API verifies workspace ownership, object size, declared MIME type and file signature.
- Production upload/download bodies travel directly between the installed app and private S3 through short-lived presigned URLs; S3 credentials are never sent to the app.
- Generated invoice/report downloads are private S3 objects with short-lived redirects; expired generated exports are removed after 24 hours when that owner next exports.
- S3 uses four explicit backend-only values: region, private bucket name, dedicated IAM access-key ID, and dedicated IAM secret. None is sent to the APK.
- Helmet security headers and explicit CORS middleware.
- All business queries are scoped server-side by authenticated user ID.
- OTPs are bcrypt-hashed, expire after 10 minutes, are single-use and allow at most 5 failed attempts.
- Admin approval is isolated behind a separate `x-admin-key` secret.

## Production hardening checklist

1. Use 32+ random bytes for `JWT_SECRET`; never keep the example secret.
2. Rotate `ADMIN_API_KEY` and, ideally, replace it with a proper staff/admin portal + staff authentication before public scale.
3. Disable Expo Go bypass.
4. Restrict CORS to any actual web/admin origins instead of `origin: true` if a browser client is added.
5. Put the API behind HTTPS only.
6. Keep MongoDB private, require TLS, least-privilege database credentials and regular backups.
7. Use R2/S3 private buckets plus signed download URLs for highly sensitive documents. The current public-base-URL option is convenient but not the final design for confidential files.
8. Add malware scanning for uploaded PDFs/images if document volume becomes material.
9. Add audit logs for login/device changes, invoice edits, deletes and admin actions.
10. Move access tokens to short lifetimes + refresh-token rotation for a higher-security release.
11. Add organization/role tables before allowing multiple users per company.
12. Add automated dependency/security scanning in CI and centralized error/abuse monitoring.
13. The in-process rate limiter is a useful per-instance layer, but it is not a distributed quota across Vercel instances. Add a shared Redis/edge/WAF rate limiter before broad public scale.

## Device identifier limitation

`ANDROID_ID` is privacy-respecting compared with IMEI and does not require reading a hardware IMEI. Android scopes it to the app-signing key, Android user and device. It can change after a factory reset or if the signing key changes, so TekBooks intentionally provides a secure device-transfer flow rather than treating the ID as permanent hardware identity.
