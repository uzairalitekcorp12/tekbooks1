import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
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
      // Allow requests without an Origin header
      // such as server-to-server requests and health checks.
      if (!origin) {
        return callback(null, true);
      }

      // During development, allow all origins when
      // no explicit CORS origins have been configured.
      if (
        env.NODE_ENV !== 'production' &&
        env.CORS_ORIGINS.length === 0
      ) {
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
 * Compression
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
 * Liveness check
 *
 * This endpoint does not depend on MongoDB or storage,
 * which keeps platform health checks useful even when
 * external dependencies are unavailable.
 */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'tekbooks-api',
    version: '1.0.9',
    environment: env.NODE_ENV,
    time: new Date().toISOString()
  });
});

/**
 * Basic API information
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
 * Readiness check
 *
 * Verifies:
 * - Runtime configuration
 * - MongoDB connection
 * - MongoDB ping
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
 * the local listener. This middleware initializes and
 * reuses Atlas/S3 connections for serverless and local
 * requests.
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
 * Local uploads
 *
 * Only serves files from the local filesystem when
 * local storage is explicitly configured.
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
 * Routes
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

    const status = Number(error?.status) || 500;

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
 * Vercel imports this Express app as the serverless
 * function entry point.
 */
export default app;
