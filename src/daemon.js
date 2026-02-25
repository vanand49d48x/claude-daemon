import { config } from './utils/config.js';
import { initDb, resetStaleTasks, closeDb } from './db.js';
import { createApp } from './server.js';
import { startQueueRunner, stopQueueRunner } from './queue.js';
import { initNotifier } from './services/notifier.js';

// Initialize database
initDb(config.dbPath);
resetStaleTasks();

// Initialize email notifications
initNotifier(config);

// Create and start Express server
const app = createApp(config.authToken);

const server = app.listen(config.port, config.host, () => {
  console.log(`[daemon] Claude Daemon running at http://${config.host}:${config.port}`);
  console.log(`[daemon] Open in browser: http://localhost:${config.port}/?token=${config.authToken}`);
});

// Start the task queue runner
startQueueRunner(config);

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n[daemon] Received ${signal}, shutting down...`);

  await stopQueueRunner();

  server.close(() => {
    closeDb();
    console.log('[daemon] Stopped.');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[daemon] Forced exit after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
