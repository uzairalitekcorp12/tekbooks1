import mongoose from 'mongoose';
import { connectDb, databaseConnectionMessage } from '../config/db.js';
import { env } from '../config/env.js';
import { ensureStorageReady } from '../services/storage.js';

const warnings: string[] = [];
if (env.NODE_ENV !== 'production') warnings.push('NODE_ENV is not production; strict production validation was not applied.');
if (env.MEDIA_ALLOW_LEGACY_SIGNATURES) warnings.push('Set MEDIA_ALLOW_LEGACY_SIGNATURES=false after old media links have been refreshed.');
if (env.STORAGE_PUBLIC_MODE === 'direct') warnings.push('Direct public storage is enabled; proxy mode with private presigned downloads is safer.');
if (env.CORS_ORIGINS.length === 0) warnings.push('No browser origins are allowed. This is correct for the APK-only deployment.');
if (env.RESEND_TEST_MODE) warnings.push('Resend test mode is enabled. Email and email-based signup work only for RESEND_TEST_RECIPIENT until you verify a domain.');

try {
  await connectDb();
  await mongoose.connection.db?.admin().ping();
  console.log('PASS MongoDB Atlas connection');
} catch (error: any) {
  console.error(`FAIL MongoDB: ${databaseConnectionMessage(error)}`);
  process.exitCode = 1;
}

try {
  const result = await ensureStorageReady(false);
  console.log(`PASS Storage connection (${result.driver})`);
} catch (error: any) {
  console.error('FAIL Storage:', error?.message || error);
  process.exitCode = 1;
}

console.log(`PASS Resend configuration (${env.RESEND_TEST_MODE ? 'one-recipient test mode' : env.RESEND_FROM})`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
await mongoose.disconnect().catch(() => {});
if (process.exitCode) process.exit(process.exitCode);
console.log(warnings.length ? 'Infrastructure is reachable; review the warnings above.' : 'Production check passed.');
