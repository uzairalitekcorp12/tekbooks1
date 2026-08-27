import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/tekbooks'),
  JWT_SECRET: z.string().min(16).default('dev-only-change-this-secret-please'),
  APP_BASE_URL: z.string().default('http://localhost:4000'),
  MOBILE_SCHEME: z.string().default('tekbooks'),
  ALLOW_EXPO_GO_DEVICE_BYPASS: z.string().default('true').transform(v => v === 'true'),
  ADMIN_API_KEY: z.string().default('dev-admin-key'),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM: z.string().default('TekBooks <onboarding@resend.dev>'),
  STORAGE_DRIVER: z.enum(['local','s3']).default('local'),
  STORAGE_PUBLIC_MODE: z.enum(['proxy','direct']).default('proxy'),
  STORAGE_KEY_PREFIX: z.string().default('users'),
  STORAGE_AUTO_CREATE_BUCKET: z.string().default('false').transform(v => v === 'true'),
  STORAGE_VALIDATE_ON_STARTUP: z.string().default('true').transform(v => v === 'true'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  MEDIA_SIGNING_SECRET: z.string().optional().default(''),
  S3_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: z.string().default('false').transform(v => v === 'true'),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_BUCKET: z.string().default('tekbooks'),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  EXPO_PUSH_ACCESS_TOKEN: z.string().optional().default('')
});

const parsed = schema.parse(process.env);
export const env = { ...parsed, MEDIA_SIGNING_SECRET: parsed.MEDIA_SIGNING_SECRET || parsed.JWT_SECRET };
