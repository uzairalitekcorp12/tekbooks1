import compression from 'compression';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { createRequire } from 'node:module';

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

/**
 * Helmet is loaded through Node's CommonJS compatibility layer.
 *
 * This avoids the TypeScript/Helmet module typing issue that
 * occurs with the current project configuration on Vercel.
 */
const require = createRequire(import.meta.url);
const helmet = require('helmet');

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

/**
 * Security headers
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

/**
 * CORS
 */
app.use(
  cors({
    credentials: false,
    origin(origin, callback) {
      // Allow requests without an Origin header.
      // This includes server-to-server requests and health checks.
      if (!origin) {
        return callback(null, true);
      }

      // TekBooks uses bearer tokens, not browser cookies. An empty list (or "*")
      // therefore exposes the API to browser clients without weakening route auth.
      // Configure an explicit comma-separated list to restrict browser deployments.
      if (env.CORS_ORIGINS.length === 0 || env.CORS_ORIGINS.includes('*')) {
        return callback(null, true);
      }

      return callback(
        null,
        env.CORS_ORIGINS.includes(origin)
      );
    }
  })
);

/**
 * Response compression
 */
app.use(compression());

/**
 * Global rate limiter
 */
app.use(globalLimiter);

/**
 * Request body parsing
 */
app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb'
  })
);

/**
 * Liveness endpoint
 *
 * This endpoint intentionally does not depend on MongoDB
 * or storage so Vercel/platform health checks remain useful
 * even when external services are unavailable.
 */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'tekbooks-api',
    version: '1.0.11',
    environment: env.NODE_ENV,
    time: new Date().toISOString()
  });
});

/**
 * API information
 */
app.get(['/', '/api'], (_req, res) => {
  res.json({
    ok: true,
    service: 'tekbooks-api',
    message: 'TekBooks API is running',
    health: '/health',
    readiness: '/ready'
  });
});

/**
 * Readiness endpoint
 *
 * Verifies:
 * - Runtime configuration
 * - MongoDB connection
 * - MongoDB availability
 * - Storage availability
 */
app.get('/ready', async (_req, res) => {
  try {
    await ensureRuntimeReady();

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database is not connected');
    }

    await mongoose.connection.db?.admin().ping();

    const storage = await ensureStorageReady(false);

    res.json({
      ok: true,
      database: 'ready',
      storage: {
        driver: storage.driver,
        ready: true
      }
    });
  } catch (error: any) {
    const message = databaseConnectionMessage(error);

    console.error(
      `Readiness check failed: ${message}`
    );

    res.status(503).json({
      ok: false,
      message:
        env.NODE_ENV === 'production'
          ? 'Service dependencies are not ready.'
          : message
    });
  }
});

/**
 * Runtime initialization middleware
 *
 * Vercel imports the Express app without executing
 * a traditional local server listener.
 *
 * This middleware initializes and reuses the required
 * Atlas/S3 connections for serverless and local requests.
 */
app.use(async (_req, _res, next) => {
  try {
    await ensureRuntimeReady();
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Local file storage
 *
 * Only expose the local uploads directory when the
 * configured storage driver is "local".
 *
 * For Vercel production deployments, use persistent
 * external storage instead of the local filesystem.
 */
if (env.STORAGE_DRIVER === 'local') {
  app.use(
    '/uploads',
    express.static(
      path.resolve(env.UPLOAD_DIR),
      {
        fallthrough: false,
        maxAge: '1h'
      }
    )
  );
}

/**
 * Application routes
 */
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

/**
 * 404 handler
 */
app.use((_req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

/**
 * Global error handler
 */
app.use(
  (
    error: any,
    _req: any,
    res: any,
    _next: any
  ) => {
    const message = databaseConnectionMessage(error);

    console.error(
      `Request failed: ${message}`
    );

    const status =
      Number(error?.status) || 500;

    const exposeMessage =
      env.NODE_ENV !== 'production' ||
      (status >= 400 && status < 500);

    res.status(status).json({
      message: exposeMessage
        ? message
        : 'Unexpected server error',

      ...(error?.code
        ? {
            code: error.code
          }
        : {})
    });
  }
);

/**
 * Vercel imports the Express app as the serverless
 * function entry point.
 */
export default app;
