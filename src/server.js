import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authMiddleware } from './middleware/auth.js';
import { createApiRouter } from './routes/api.js';
import { createUiRouter } from './routes/ui.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(authToken) {
  const app = express();

  // Parse JSON bodies and cookies
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Auth on everything
  app.use(authMiddleware(authToken));

  // Static assets (CSS, JS) — auth middleware allows these through
  app.use(express.static(resolve(__dirname, '../public')));

  // API routes
  app.use('/api', createApiRouter());

  // UI routes
  app.use(createUiRouter());

  return app;
}
