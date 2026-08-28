import compression from 'compression';
import cors from 'cors';
import express from 'express';
import * as helmetModule from 'helmet';
import mongoose from 'mongoose';
import path from 'node:path';
import { databaseConnectionMessage } from './config/db.js';
import { env } from './config/env.js';
import { ensureRuntimeReady } from './config/runtime.js';
import { globalLimiter } from './middleware/security.js';
import admin from './routes/admin.js';
import auth from './routes/auth.js';
import dashboard from './routes/dashboard.js';
import invoices from './routes/invoices.js';
import media from './routes/media.js';
import parties from './routes/parties.js';
import profile from './routes/profile.js';
import reports from './routes/reports.js';
import transactions from './routes/transactions.js';
import uploads from './routes/uploads.js';
import { ensureStorageReady } from './services/storage.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmetModule.default({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  credentials: false,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.NODE_ENV !== 'production' && env.CORS_ORIGINS.length === 0) return callback(null, true);
    return callback(null, env.CORS_ORIGINS.includes(origin));
  }
}));
app.use(compression());
app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Liveness does not depend on Atlas or S3, which keeps platform health checks useful.
app.get('/health', (_req, res) => res.json({
  ok: true,
  service: 'tekbooks-api',
  version: '1.0.9',
  environment: env.NODE_ENV,
  time: new Date().toISOString()
}));

app.get(['/', '/api'], (_req, res) => res.json({
  ok: true,
  service: 'tekbooks-api',
  message: 'TekBooks API is running',
  health: '/health',
  readiness: '/ready'
}));

app.get('/ready', async (_req, res) => {
  try {
    await ensureRuntimeReady();
    if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
    await mongoose.connection.db?.admin().ping();
    const storage = await ensureStorageReady(false);
    res.json({ ok: true, database: 'ready', storage: { driver: storage.driver, ready: true } });
  } catch (error: any) {
    const message = databaseConnectionMessage(error);
    console.error(`Readiness check failed: ${message}`);
    res.status(503).json({
      ok: false,
      message: env.NODE_ENV === 'production' ? 'Service dependencies are not ready.' : message
    });
  }
});

// Vercel imports the Express app without executing the local listener. This middleware
// initializes and reuses Atlas/S3 connections for both serverless and local requests.
app.use(async (_req, _res, next) => {
  try {
    await ensureRuntimeReady();
    next();
  } catch (error) {
    next(error);
  }
});

if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { fallthrough: false, maxAge: '1h' }));
}
app.use('/media', media);
app.use('/api/auth', auth);
app.use('/api/parties', parties);
app.use('/api/transactions', transactions);
app.use('/api/invoices', invoices);
app.use('/api/dashboard', dashboard);
app.use('/api/profile', profile);
app.use('/api/uploads', uploads);
app.use('/api/reports', reports);
app.use('/api/admin', admin);
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((error: any, _req: any, res: any, _next: any) => {
  const message = databaseConnectionMessage(error);
  console.error(`Request failed: ${message}`);
  const exposeMessage = env.NODE_ENV !== 'production' || (Number(error?.status) >= 400 && Number(error?.status) < 500);
  res.status(error?.status || 500).json({
    message: exposeMessage ? message : 'Unexpected server error',
    ...(error?.code ? { code: error.code } : {})
  });
});

// `src/app.ts` is the first recognized Express entry point Vercel discovers.
// Keep a default export here so framework detection creates one Express Function.
export default app;
