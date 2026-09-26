import 'dotenv/config';
import { z } from 'zod';

const productionDefaults = process.env.NODE_ENV === 'production';
if (!process.env.APP_BASE_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.APP_BASE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

const booleanValue = (fallback: boolean) => z
  .enum(['true', 'false'])
  .default(String(fallback) as 'true' | 'false')
  .transform(value => value === 'true');

const optionalUrl = z.union([z.literal(''), z.string().url()]).default('');

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1).refine(
    value => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
    'MONGODB_URI must be a MongoDB connection string.'
  ).default('mongodb://127.0.0.1:27017/tekbooks'),
  MONGODB_DB_NAME: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).default('tekbooks'),
  LOGIN_USERNAME: z.union([
    z.literal(''),
    z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,31}@tekbooks$/)
  ]).default(''),
  LOGIN_USER_EMAIL: z.union([z.literal(''), z.string().trim().email()]).default(''),
  LOGIN_NOTIFICATION_EMAIL: z.union([z.literal(''), z.string().trim().email()]).default(''),
  JWT_SECRET: z.string().min(16).default('dev-only-change-this-secret-please'),
  APP_BASE_URL: z.string().url().default('http://localhost:4000'),
  MOBILE_SCHEME: z.string().regex(/^[a-z][a-z0-9+.-]*$/i).default('tekbooks'),
  CORS_ORIGINS: z.string().default(''),
  ALLOW_EXPO_GO_DEVICE_BYPASS: booleanValue(!productionDefaults),
  ALLOW_EXPO_GO_LOGIN: booleanValue(false),
  ADMIN_API_KEY: z.string().min(8).default('dev-admin-key'),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().min(3).default('TekBooks <onboarding@resend.dev>'),
  RESEND_TEST_MODE: booleanValue(false),
  RESEND_TEST_RECIPIENT: z.union([z.literal(''), z.string().email()]).default(''),
  EMAIL_DEV_LOG_CODES: booleanValue(!productionDefaults),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_PUBLIC_MODE: z.enum(['proxy', 'direct']).default('proxy'),
  STORAGE_KEY_PREFIX: z.string().regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/).default('users'),
  STORAGE_AUTO_CREATE_BUCKET: booleanValue(false),
  STORAGE_VALIDATE_ON_STARTUP: booleanValue(true),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
  MEDIA_SIGNING_SECRET: z.string().default(''),
  MEDIA_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(86_400),
  MEDIA_ALLOW_LEGACY_SIGNATURES: booleanValue(!productionDefaults),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ENDPOINT: optionalUrl,
  S3_FORCE_PATH_STYLE: booleanValue(false),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_BUCKET: z.string().min(3).default('tekbooks'),
  S3_PUBLIC_BASE_URL: optionalUrl,
  S3_CORS_ORIGINS: z.string().default('*'),
  S3_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  S3_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  EXPO_PUSH_ACCESS_TOKEN: z.string().default('')
});

const schema = baseSchema.superRefine((value, context) => {
  const issue = (path: keyof typeof value, message: string) => context.addIssue({
    code: 'custom',
    path: [path],
    message
  });

  if (!!value.S3_ACCESS_KEY_ID !== !!value.S3_SECRET_ACCESS_KEY) {
    issue('S3_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together.');
  }
  if (value.LOGIN_USER_EMAIL && !value.LOGIN_USERNAME) {
    issue('LOGIN_USERNAME', 'LOGIN_USERNAME is required when the legacy LOGIN_USER_EMAIL fallback is configured.');
  }
  if (value.LOGIN_NOTIFICATION_EMAIL && !value.LOGIN_USERNAME) {
    issue('LOGIN_USERNAME', 'LOGIN_USERNAME is required when LOGIN_NOTIFICATION_EMAIL is configured.');
  }
  if (value.STORAGE_DRIVER === 's3' && value.S3_ENDPOINT && !value.S3_ACCESS_KEY_ID) {
    issue('S3_ACCESS_KEY_ID', 'An S3-compatible custom endpoint requires explicit access credentials.');
  }
  if (value.STORAGE_PUBLIC_MODE === 'direct' && !value.S3_PUBLIC_BASE_URL) {
    issue('S3_PUBLIC_BASE_URL', 'Direct public storage mode requires S3_PUBLIC_BASE_URL.');
  }

  if (value.NODE_ENV !== 'production') return;

  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value.MONGODB_URI)) {
    issue('MONGODB_URI', 'Production must use a remote MongoDB deployment such as MongoDB Atlas.');
  }
  if (value.JWT_SECRET.length < 32 || value.JWT_SECRET.includes('dev-only')) {
    issue('JWT_SECRET', 'Production JWT_SECRET must be a unique value of at least 32 characters.');
  }
  if (value.MEDIA_SIGNING_SECRET.length < 32) {
    issue('MEDIA_SIGNING_SECRET', 'Production MEDIA_SIGNING_SECRET must be a separate value of at least 32 characters.');
  }
  if (value.ADMIN_API_KEY.length < 32 || value.ADMIN_API_KEY.includes('dev-admin')) {
    issue('ADMIN_API_KEY', 'Production ADMIN_API_KEY must be a unique value of at least 32 characters.');
  }
  if (!value.APP_BASE_URL.startsWith('https://')) {
    issue('APP_BASE_URL', 'Production APP_BASE_URL must use HTTPS.');
  }
  if (value.ALLOW_EXPO_GO_DEVICE_BYPASS) {
    issue('ALLOW_EXPO_GO_DEVICE_BYPASS', 'Expo Go device bypass must be disabled in production.');
  }
  if (!value.RESEND_API_KEY.startsWith('re_')) {
    issue('RESEND_API_KEY', 'Production requires a Resend API key.');
  }
  const usesResendTestSender = /onboarding@resend\.dev/i.test(value.RESEND_FROM);
  if (!/@/.test(value.RESEND_FROM)) {
    issue('RESEND_FROM', 'RESEND_FROM must contain a sender email address.');
  } else if (value.RESEND_TEST_MODE) {
    if (!usesResendTestSender) {
      issue('RESEND_FROM', 'Resend test mode must use onboarding@resend.dev. Disable test mode after verifying a domain.');
    }
    if (!value.RESEND_TEST_RECIPIENT) {
      issue('RESEND_TEST_RECIPIENT', 'Resend test mode requires the email address used to create the Resend account.');
    }
    if (value.LOGIN_NOTIFICATION_EMAIL && value.LOGIN_NOTIFICATION_EMAIL.toLowerCase() !== value.RESEND_TEST_RECIPIENT.toLowerCase()) {
      issue('LOGIN_NOTIFICATION_EMAIL', 'In Resend test mode, LOGIN_NOTIFICATION_EMAIL must match RESEND_TEST_RECIPIENT.');
    }
  } else if (usesResendTestSender) {
    issue('RESEND_FROM', 'Use a verified Resend domain, or explicitly enable RESEND_TEST_MODE for a one-recipient test deployment.');
  }
  if (value.STORAGE_DRIVER !== 's3') {
    issue('STORAGE_DRIVER', 'Production storage must use S3 because serverless local files are ephemeral.');
  }
  if (!value.S3_ACCESS_KEY_ID || !value.S3_SECRET_ACCESS_KEY) {
    issue('S3_ACCESS_KEY_ID', 'Production S3 storage requires least-privilege access credentials.');
  }
  if (value.STORAGE_AUTO_CREATE_BUCKET) {
    issue('STORAGE_AUTO_CREATE_BUCKET', 'Create the production bucket separately and disable automatic bucket creation.');
  }
});

const parsed = schema.parse(process.env);
export const env = {
  ...parsed,
  CORS_ORIGINS: parsed.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean),
  S3_CORS_ORIGINS: parsed.S3_CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean),
  MEDIA_SIGNING_SECRET: parsed.MEDIA_SIGNING_SECRET || parsed.JWT_SECRET,
  IS_SERVERLESS: process.env.VERCEL === '1'
};
