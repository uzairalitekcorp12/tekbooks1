import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { env } from './env.js';
import { ensureStorageReady } from '../services/storage.js';

let runtimePromise: Promise<void> | null = null;

/** Initialize external services once per process/function instance and retry after transient failures. */
export async function ensureRuntimeReady() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await connectDb();
      if (env.STORAGE_VALIDATE_ON_STARTUP) await ensureStorageReady(env.STORAGE_AUTO_CREATE_BUCKET);
    })().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  await runtimePromise;

  // A warm serverless function can outlive MongoDB's idle connection. The
  // initialization promise remains resolved in that case, so explicitly
  // restore the pool before allowing the request to continue.
  if (mongoose.connection.readyState !== 1) await connectDb();
}
