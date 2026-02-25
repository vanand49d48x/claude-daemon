import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv();

function envOrDefault(key, fallback) {
  return process.env[key] || fallback;
}

function findClaude() {
  const explicit = process.env.CLAUDE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  // Check common locations
  const candidates = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    resolve(process.env.HOME || '/root', '.npm-global/bin/claude'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fall back to bare command (relies on PATH)
  return 'claude';
}

export const config = {
  port: parseInt(envOrDefault('PORT', '3456'), 10),
  host: envOrDefault('HOST', '0.0.0.0'),

  authToken: process.env.AUTH_TOKEN,

  claudePath: findClaude(),
  defaultProjectDir: envOrDefault('DEFAULT_PROJECT_DIR', '/projects'),
  maxTurns: parseInt(envOrDefault('MAX_TURNS', '50'), 10),
  taskTimeoutMs: parseInt(envOrDefault('TASK_TIMEOUT_MS', '1800000'), 10),

  emailEnabled: envOrDefault('EMAIL_ENABLED', 'false') === 'true',
  smtpHost: envOrDefault('SMTP_HOST', 'smtp.gmail.com'),
  smtpPort: parseInt(envOrDefault('SMTP_PORT', '587'), 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  notifyTo: process.env.NOTIFY_TO || '',

  dbPath: envOrDefault('DB_PATH', '/data/daemon.db'),
};

// Validate required config
if (!config.authToken || config.authToken === 'change-me-to-a-random-secret') {
  console.error('ERROR: Set AUTH_TOKEN in .env to a strong random secret.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Detect Claude auth method
if (process.env.ANTHROPIC_API_KEY) {
  console.log('[config] Claude auth: ANTHROPIC_API_KEY environment variable');
} else if (existsSync(resolve(process.env.HOME || '/root', '.claude'))) {
  console.log('[config] Claude auth: ~/.claude config directory');
} else {
  console.warn('[config] WARNING: No Claude authentication found. Tasks may fail.');
  console.warn('         Set ANTHROPIC_API_KEY in .env or mount ~/.claude into the container.');
}
