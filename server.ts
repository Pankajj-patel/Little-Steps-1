import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from './server/db/connection.ts';
import { runMigrations } from './server/db/schema.ts';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { LittleStepsRepository } from './server/repositories/index.ts';
import { createApiRouter } from './server/routes/api.ts';
import { RetentionWorker } from './server/services/retentionWorker.ts';
import { mediaStorage } from './server/storage/mediaStorage.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  // 1. Initialize SQLite database, migrations, and starter seed
  const db = getDb();
  runMigrations(db);
  seedDatabaseIfEmpty(db);

  const repo = new LittleStepsRepository(db);
  const retentionWorker = new RetentionWorker(repo, mediaStorage);
  retentionWorker.startHourlySchedule();

  // 2. Configure Express application
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Security headers (compatible with AI Studio preview iframe)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
  });

  // Never allow browsers or intermediary proxies to cache private API responses
  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    next();
  });

  // Mount versioned REST API
  app.use('/api/v1', createApiRouter(repo, mediaStorage, retentionWorker));

  // 3. Mount Vite dev middleware in development or static dist in production
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LittleSteps server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LittleSteps server:', err);
  process.exit(1);
});
