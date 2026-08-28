import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

function isLocalMongoUri(uri: string) {
  return /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(uri);
}

/** Return a short operator-facing message without dumping Mongoose's topology object. */
export function databaseConnectionMessage(error: any) {
  const detail = String(error?.message || error?.cause?.message || 'MongoDB connection failed').split('\n')[0];
  const mongoError = /mongo|mongoose/i.test(String(error?.name || '')) || !!error?.reason?.servers || /ECONNREFUSED.*27017|server selection/i.test(detail);
  if (!mongoError) return detail;
  if (isLocalMongoUri(env.MONGODB_URI) && /ECONNREFUSED|server selection|connect/i.test(detail)) {
    return 'Local MongoDB is not running at 127.0.0.1:27017. Start Docker Desktop and run `npm run db:start`, start the MongoDB Windows service, or set backend/.env MONGODB_URI to a MongoDB Atlas URI.';
  }
  return `MongoDB is unavailable. Check MONGODB_URI, credentials, Atlas Network Access, and DNS. (${detail})`;
}

/** Reuse the MongoDB pool across warm serverless invocations and local requests. */
export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000
    });
  }
  try {
    const connection = await connectionPromise;
    console.log('MongoDB connected');
    return connection;
  } finally {
    // Keep Mongoose's pool, but do not retain a settled promise. If the pool is
    // disconnected later, the next request can establish a new connection.
    connectionPromise = null;
  }
}
