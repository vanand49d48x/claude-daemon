import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../../public');

export function createUiRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.sendFile(resolve(publicDir, 'index.html'));
  });

  router.get('/task/:id', (req, res) => {
    res.sendFile(resolve(publicDir, 'task.html'));
  });

  return router;
}
