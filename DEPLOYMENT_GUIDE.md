# TekBooks: local development to installed Android app

For the shortest beginner path, use [EASY_SETUP.md](./EASY_SETUP.md). This document remains the expanded reference.

This repository is configured for the following production path:

```text
Installed Expo APK
  ├─ JSON/auth/report requests ──> Vercel Express Function ──> MongoDB Atlas
  ├─ transactional email ────────> Vercel Express Function ──> Resend
  └─ file upload/download ───────> short-lived signed URL ───> private Amazon S3
```

The mobile app needs only internet access after installation. MongoDB, S3, Resend, and all secrets remain behind the backend; the APK contains only the public HTTPS API URL.

## Important Vercel plan note

Vercel Hobby is restricted to personal, non-commercial use. It is suitable for development or a personal pilot. If TekBooks is used by a business or for financial gain, use Vercel Pro or another commercial host such as Render. The code and Dockerfile support either host; the primary steps below use Vercel.

## 1. Local development

### Expo SDK compatibility lock

This project intentionally remains on Expo SDK 54, React Native 0.81, and React 19.1 so it can run in the SDK 54 Expo Go already installed on the test phone. Do not run a forced npm audit fix or upgrade Expo beyond SDK 54 unless the phone/testing workflow is upgraded at the same time. The npm audit findings that remain in the mobile tree are within Expo/Metro's Node-based build tooling; the backend production dependency audit is clean.

### Prerequisites

- Node.js 22
- npm 10 or newer
- Docker Desktop only if you prefer local MongoDB; Atlas-backed local development does not need it
- Android phone with Expo Go for development
- Git for deployment

### Install and configure

From the repository root:

```powershell
npm run setup
```

Do not overwrite an existing `backend/.env` or `mobile/.env`. For a fresh clone:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item mobile/.env.example mobile/.env
```

For the simplest local setup, keep these backend values:

```dotenv
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/tekbooks
APP_BASE_URL=http://localhost:4000
ALLOW_EXPO_GO_DEVICE_BYPASS=true
RESEND_API_KEY=
EMAIL_DEV_LOG_CODES=true
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
```

Use unique local JWT/admin values; never reuse production secrets. When Resend is blank, development OTPs are printed only to the backend terminal.

Start MongoDB and validate both projects. Docker Desktop must be installed and running before `db:start`:

```powershell
npm run db:start
npm run db:check
npm run typecheck
npm --prefix backend run config:check
```

`ECONNREFUSED 127.0.0.1:27017` means nothing is listening on the local MongoDB port. It is not an Expo, Android, firewall, or Wi-Fi-address error. If Docker is not installed, either install Docker Desktop/start a native MongoDB Windows service, or replace `MONGODB_URI` with an Atlas connection string. The backend deliberately keeps `/health` available and returns `/ready` as 503 while MongoDB is unavailable.

Start the API and Expo:

```powershell
npm run dev
```

`npm run dev` detects the active private Wi-Fi/Ethernet IPv4 address and overrides a stale local `mobile/.env` value for that session. Restart the command after moving to another Wi-Fi. `mobile/.env` is only a development fallback; it is never the address an installed production APK should use.

If LAN discovery is blocked, use:

```powershell
npm run dev:tunnel
```

Tunnel mode sends API and media requests through Expo Metro's tunnel, so the phone does not need to share the computer's Wi-Fi. The local backend and MongoDB must still be running on the computer.

Test these URLs from the computer:

- `http://localhost:4000/health`
- `http://localhost:4000/ready`

Create an account in the app, enter the OTP printed by the API, then approve it:

```powershell
npm --prefix backend run approve -- user@example.com
```

Test signup, verification, login, profile/logo upload, a receipt/PDF attachment, invoice PDF, report PDF/XLSX, logout/login, and the replacement-device flow before cloud deployment.

## 2. MongoDB Atlas

1. Create a MongoDB Atlas account and a project named, for example, `TekBooks Production`.
2. Create the smallest cluster suitable for the pilot. Choose a region close to the Vercel Function region to reduce latency.
3. In **Database Access**, create a dedicated database user. Grant only `readWrite` on the `tekbooks` database; do not use an Atlas administrator credential in the app.
4. Use a long random password and store it in a password manager.
5. In **Network Access / IP Access List**, allow the backend's outbound address.
   - Vercel serverless egress is not automatically the address of your laptop.
   - If the selected Vercel plan has no fixed outbound IP, a pilot commonly needs `0.0.0.0/0`. This exposes the Atlas listener to connection attempts, so strong unique credentials, TLS, least privilege, and prompt credential rotation are essential.
   - For a serious production deployment, prefer Vercel Static IPs/Secure Compute or another host with fixed egress, then allowlist only those addresses.
6. Click **Connect → Drivers → Node.js** and copy the SRV URI.
7. Replace the username/password placeholders and ensure the database path is `/tekbooks`.

Example shape only:

```dotenv
MONGODB_URI=mongodb+srv://TEKBOOKS_USER:URL_ENCODED_PASSWORD@CLUSTER.mongodb.net/tekbooks?retryWrites=true&w=majority
```

If the password contains `@`, `:`, `/`, `?`, `#`, or `%`, URL-encode it. Never commit the URI.

## 3. Private Amazon S3

### Create the bucket

1. In AWS S3, create a globally unique bucket such as `tekbooks-prod-ACCOUNTID`.
2. Choose a region close to Atlas/Vercel.
3. Keep **Block all public access** enabled.
4. Keep ACLs disabled / Bucket owner enforced.
5. Keep default server-side encryption enabled. AWS applies SSE-S3 by default; use SSE-KMS if your compliance requirements need customer-managed keys.
6. Enable versioning if you need recovery from accidental replacement/deletion.

If you choose SSE-KMS, also grant the TekBooks IAM identity the required KMS encrypt/decrypt/data-key permissions in both IAM and the KMS key policy. The S3-only policy below is sufficient for the default SSE-S3 mode.

Do not create a public bucket and do not set `S3_PUBLIC_BASE_URL`. TekBooks keeps files private and uses short-lived signed URLs.

### Create a least-privilege IAM identity

Create a dedicated IAM user or role for TekBooks. Replace both instances of `YOUR_BUCKET` in this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InspectTekBooksBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET"
    },
    {
      "Sid": "ManageTekBooksObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/users/*"
    }
  ]
}
```

Create an access key for this one identity. Store the access-key ID and secret only in Vercel/your password manager.

### CORS

Native Android requests are not governed by browser CORS. No S3 CORS rule is needed for the APK. If you also run Expo Web, add an S3 CORS rule limited to the exact development/website origins and the `PUT`, `GET`, and `HEAD` methods. Do not use a public bucket policy.

### Production S3 values

```dotenv
STORAGE_DRIVER=s3
S3_REGION=YOUR_BUCKET_REGION
S3_BUCKET=YOUR_EXACT_PRIVATE_BUCKET
S3_ACCESS_KEY_ID=YOUR_DEDICATED_IAM_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_DEDICATED_IAM_SECRET_ACCESS_KEY
```

The AWS account owner supplies exactly these four values. The friend-facing instructions are in [backend/infra/aws/FRIEND_S3_SETUP.md](./backend/infra/aws/FRIEND_S3_SETUP.md).

The app requests a five-minute signed PUT, uploads directly to S3, then asks the API to verify owner, size, MIME type, and file signature. Downloads redirect to a five-minute private GET URL. This avoids Vercel's 4.5 MB Function payload limit while keeping the bucket private.

Orphan cleanup is dry-run by default:

```powershell
npm --prefix backend run storage:cleanup -- --older-than-hours=24
```

After reviewing the listed keys:

```powershell
npm --prefix backend run storage:cleanup -- --older-than-hours=24 --delete
```

## 4. Resend

1. Create a Resend account.
2. Add a sending domain. A subdomain such as `mail.example.com` is a good way to isolate mail reputation.
3. Add the SPF and DKIM records Resend shows to your DNS provider. Add DMARC as a recommended follow-up.
4. Wait until the domain status is **Verified**.
5. Create a sending API key dedicated to TekBooks production.
6. Choose a sender on the verified domain.

```dotenv
RESEND_API_KEY=re_REPLACE_WITH_REAL_KEY
RESEND_FROM=TekBooks <no-reply@mail.example.com>
EMAIL_DEV_LOG_CODES=false
```

If you do not own a domain yet, TekBooks supports an explicit one-recipient Vercel test deployment:

```dotenv
RESEND_FROM=TekBooks <onboarding@resend.dev>
RESEND_TEST_MODE=true
RESEND_TEST_RECIPIENT=YOUR_RESEND_ACCOUNT_EMAIL
EMAIL_DEV_LOG_CODES=false
```

Resend allows this sender to deliver only to the email address associated with the Resend account. TekBooks enforces the same restriction before signup. After verifying a domain, use your verified-domain sender, set `RESEND_TEST_MODE=false`, and clear `RESEND_TEST_RECIPIENT`.

After deployment, create a test workspace with an email you control and confirm:

- signup OTP arrives;
- password-reset OTP arrives;
- device-change OTP arrives;
- approval email arrives;
- Resend shows a successful delivery event rather than a rejected/bounced event.

## 5. Vercel backend

You can deploy from the dashboard or run the current Vercel CLI through `npx`; a global CLI install is not required.

### Dashboard deployment

1. Push this repository to a private Git provider repository.
2. In Vercel, select **Add New → Project** and import it.
3. Set **Root Directory** to `backend` for the full repository, or `.` when the Git repository contains only the contents of the backend folder.
4. Set **Framework Preset** to **Express**. The tracked `backend/vercel.json` pins the same setting, and Vercel detects the default Express export at `src/app.ts`.
5. Use Node.js 22.
6. Keep Install Command at its default. Do not set a Build Command or Output Directory; Vercel detects and compiles the Express TypeScript entry point.
7. Add the environment variables below to **Production**. Add a separate safe set to **Preview**, or disable preview deployments. A Vercel Preview also runs with production-style validation.

Required production variables:

| Name | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://YOUR_PROJECT.vercel.app` or your API domain |
| `MONGODB_URI` | secret Atlas SRV URI |
| `MONGODB_DB_NAME` | `tekbooks` |
| `JWT_SECRET` | unique random value, at least 32 characters |
| `MEDIA_SIGNING_SECRET` | a second unique random value, at least 32 characters |
| `ADMIN_API_KEY` | a third unique random value, at least 32 characters |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | verified-domain sender, or `TekBooks <onboarding@resend.dev>` for temporary test mode |
| `RESEND_TEST_MODE` | `true` without a domain; `false` after domain verification |
| `RESEND_TEST_RECIPIENT` | Resend account email in test mode; empty after domain verification |
| `STORAGE_DRIVER` | `s3` |
| `S3_REGION` | exact bucket region supplied by the AWS owner |
| `S3_BUCKET` | exact private bucket name |
| `S3_ACCESS_KEY_ID` | dedicated IAM access-key ID |
| `S3_SECRET_ACCESS_KEY` | dedicated IAM secret access key |

Production-safe defaults supply proxy/private storage, five-minute signed S3 URLs, a 10 MB upload limit, disabled Expo Go bypass, no OTP terminal logging, no legacy media signatures, and no bucket auto-creation. Optional: `CORS_ORIGINS` for a future web client and `EXPO_PUSH_ACCESS_TOKEN` for authenticated Expo push requests.

8. Deploy.
9. Open:
   - `https://YOUR_PROJECT.vercel.app/health`
   - `https://YOUR_PROJECT.vercel.app/ready`
10. `/health` should return `ok: true`. `/ready` must report both database and storage ready.

### CLI deployment

From `backend`:

```powershell
npx vercel login
npx vercel whoami
npx vercel link
npx vercel env ls
npx vercel env run -e production -- npm run production:check
npx vercel --prod
```

Do not run migrations or seed commands against Atlas until `vercel env ls` confirms that the project is linked to the intended account/project.

### Approve a production signup

For the current MVP, run the approval script only from a trusted terminal with production environment variables:

```powershell
npx vercel env run -e production -- npm run approve -- user@example.com
```

Never put `ADMIN_API_KEY` in the APK. Before multiple staff members operate the product, replace this shared-key workflow with a staff login, role checks, and audit log.

## 6. Build and install the APK

The `preview` EAS profile already produces an APK. The `production` profile produces an AAB for Google Play.

Both installed profiles disable LAN/Metro discovery. An EAS post-install guard stops the build if `EXPO_PUBLIC_API_URL` is missing, is not HTTPS, points to localhost/emulator/private LAN, or does not end in `/api`. This prevents accidentally shipping an APK tied to the current Wi-Fi.

### Connect the Expo project

```powershell
Set-Location mobile
npx eas-cli login
npx eas-cli init
```

`eas init` adds the EAS project ID to app configuration. Commit that non-secret project identifier.

### Check the public API configuration

These values are embedded in the app and are intentionally public. The tracked `mobile/eas.json` supplies them to both installed profiles, and `mobile/.env.example` supplies the same Vercel values for Expo Go:

```dotenv
EXPO_PUBLIC_API_URL=https://tekbooks-khaki.vercel.app/api
EXPO_PUBLIC_AUTO_LAN=false
EXPO_PUBLIC_PROXY_API_THROUGH_METRO=false
```

Do not place MongoDB, S3, Resend, JWT, or admin secrets in any `EXPO_PUBLIC_` variable.

Verify the resolved build configuration before building:

```powershell
Set-Location mobile
npx expo config --type public
```

TekBooks 1.0.11 adds `expo-intent-launcher` for reliable attachment opening. Build and install a fresh APK; an EAS Update cannot add this native module to an older APK.

### Build an installable APK

From the repository root:

```powershell
npm run build:apk
```

Or from `mobile`:

```powershell
npx eas-cli build --platform android --profile preview
```

When EAS finishes:

1. Open the build URL or scan the QR code on the Android phone.
2. Download the APK.
3. Allow installation from that browser/file manager when Android prompts.
4. Install TekBooks.
5. Confirm the installed app reaches the HTTPS Vercel API with Wi-Fi/mobile data and no development computer running.

For Google Play, increment `expo.android.versionCode` for every release and build:

```powershell
npm run build:aab
```

Google Play distributes the AAB; it is not directly installable like an APK.

## 7. Final acceptance checklist

In one-recipient Resend test mode, use only `RESEND_TEST_RECIPIENT` for signup, password reset, and device-code email checks.

- [ ] Backend and mobile type checks pass.
- [ ] Backend dependency audit reports zero known vulnerabilities.
- [ ] Expo Doctor passes. Review mobile npm-audit findings against the supported Expo SDK; do not use `npm audit fix --force` because it can perform an unsupported major SDK upgrade.
- [ ] `/health` and `/ready` pass on Vercel.
- [ ] Atlas contains only real test records; no bundled sample user exists.
- [ ] S3 Block Public Access is on and objects cannot be opened without a signed URL.
- [ ] A 5–10 MB PDF uploads from the installed APK without a Vercel 413 response.
- [ ] Profile images, company logos, and attachments still open after restarting/reinstalling the app.
- [ ] Signup/reset/device/approval emails appear in Resend delivery logs.
- [ ] Expo Go login is rejected by the production backend; installed APK login succeeds.
- [ ] Wrong-device login triggers the approval/OTP flow.
- [ ] Invoice PDF and report PDF/XLSX downloads work.
- [ ] JWT, media, admin, Atlas, AWS, and Resend credentials are all distinct and stored only in provider secret settings.
- [ ] Atlas backup/restore and S3 recovery/versioning have been tested before real financial data is accepted.

## Troubleshooting

- **Vercel Function crashes during startup:** inspect Runtime Logs. Strict validation reports the missing/unsafe environment key.
- **`/ready` says MongoDB is unavailable:** verify the Atlas URI, URL-encoded password, database user role, and IP Access List.
- **`/ready` says storage is unavailable:** verify bucket name/region and IAM `ListBucket` permission.
- **S3 PUT returns 403:** check the device clock, IAM `PutObject`, bucket region, and that the signed URL was used before its five-minute expiry.
- **Resend/test mode returns 403:** `onboarding@resend.dev` can send only to `RESEND_TEST_RECIPIENT`. Use that account email, or verify a domain and disable test mode.
- **Installed APK still calls `10.0.2.2`:** set the EAS `EXPO_PUBLIC_API_URL` in the profile's environment and rebuild the APK. Environment values are embedded at build time.
- **Vercel returns 413 on an upload:** an old mobile build is using the multipart endpoint. Rebuild/install the current APK, which uses `/api/uploads/presign`.
- **Local Expo phone cannot connect:** use `npm run network:check`, allow Node through Windows Firewall, or use `npm run dev:tunnel`.
- **`ECONNREFUSED 127.0.0.1:27017`:** start Docker Desktop and run `npm run db:start`, or configure Atlas in `backend/.env`; changing `mobile/.env` cannot fix a stopped database.
- **Wi-Fi address changed:** restart `npm run dev`; the launcher ignores a stale private address and advertises the active adapter. Use `npm run network:check` to see the selected address.

## Official references

- Vercel Express: <https://vercel.com/docs/frameworks/backend/express>
- Vercel Function limits: <https://vercel.com/docs/functions/limitations>
- Vercel Hobby terms: <https://vercel.com/docs/plans/hobby>
- MongoDB Atlas IP Access List: <https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/>
- MongoDB Atlas database users: <https://www.mongodb.com/docs/atlas/security-add-mongodb-users/>
- AWS S3 Block Public Access: <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html>
- AWS S3 presigned URL security: <https://docs.aws.amazon.com/prescriptive-guidance/latest/presigned-url-best-practices/foundational-best-practices.html>
- Resend domains: <https://resend.com/docs/dashboard/domains/introduction>
- Expo EAS environments: <https://docs.expo.dev/eas/environment-variables/>
- Expo APK builds: <https://docs.expo.dev/build-reference/apk/>
