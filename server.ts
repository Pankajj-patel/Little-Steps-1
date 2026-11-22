import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './server/db/connection.ts';
import { runMigrations } from './server/db/schema.ts';
import { seedDatabaseIfEmpty, syncConfiguredStaffPasswords } from './server/db/seed.ts';
import { LittleStepsRepository } from './server/repositories/index.ts';
import { createApiRouter } from './server/routes/api.ts';
import { RetentionWorker } from './server/services/retentionWorker.ts';
import { mediaStorage } from './server/storage/mediaStorage.ts';

// Environment & Port detection:
// - AI Studio sandbox containers (ais-dev-* / ais-pre-*) run nginx on 8080 proxying to app port 3000.
// - Published Cloud Run containers have no local nginx and inject process.env.PORT (typically 8080).
const distDir = path.resolve(process.cwd(), 'dist');
const kService = process.env.K_SERVICE || '';
const isAiStudioDev = kService.startsWith('ais-dev-');
const isAiStudioSandbox = /^ais-(dev|pre)-/.test(kService);
const isPublishedCloudRun = Boolean(kService) && !isAiStudioSandbox;

const isProduction =
  !isAiStudioDev && (process.env.NODE_ENV === 'production' || isPublishedCloudRun || kService.startsWith('ais-pre-'));

const PORT = isAiStudioSandbox
  ? 3000
  : Number(process.env.PORT || (isProduction ? 8080 : 3000));

export function createApp() {
  // 1. Initialize SQLite database, migrations, and starter seed
  const db = getDb();
  runMigrations(db);
  seedDatabaseIfEmpty(db);
  syncConfiguredStaffPasswords(db);

  const repo = new LittleStepsRepository(db);
  const retentionWorker = new RetentionWorker(repo, mediaStorage);

  // 2. Configure Express application
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Security headers (compatible with AI Studio preview iframe, Google Fonts, and local video blobs)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: data:",
        "connect-src 'self' ws: wss:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
    next();
  });

  // Cloud Run & GCP Load Balancer container health probes
  app.get(['/healthz', '/health'], (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'LittleSteps' });
  });

  // Never allow browsers or intermediary proxies to cache private API responses
  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    next();
  });

  // Mount versioned REST API
  app.use('/api/v1', createApiRouter(repo, mediaStorage, retentionWorker));

  // Centralized API error handler (prevents raw stack traces or HTML error pages on /api/v1)
  app.use(
    '/api/v1',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      const safeMessage =
        status < 500 && err instanceof Error
          ? err.message
          : 'An unexpected server error occurred. Please try again.';
      if (status >= 500 && process.env.NODE_ENV !== 'test') {
        console.error('[LittleSteps API Error]', err instanceof Error ? err.message : 'Unknown error');
      }
      if (!res.headersSent) {
        res.status(status).json({ error: safeMessage });
      }
    }
  );

  return { app, repo, retentionWorker, db };
}

async function startServer() {
  const { app, retentionWorker } = createApp();
  retentionWorker.startHourlySchedule();

  // 3. Mount Vite dev middleware in development or static dist in production
  let viteServer: { close: () => Promise<void> } | null = null;
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const enableHmr = process.env.DISABLE_HMR !== 'true' && !isAiStudioDev;
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr,
      },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Please run npm run build.');
      }
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `LittleSteps server listening on http://0.0.0.0:${PORT} [mode: ${isProduction ? 'production' : 'development'}]`
    );
  });

  const shutdown = () => {
    httpServer.close(() => {
      void viteServer?.close().finally(() => process.exit(0));
      if (!viteServer) process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectEntry = entryFilePath === currentFilePath;

if (isDirectEntry && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start LittleSteps server:', err);
    process.exit(1);
  });
}
