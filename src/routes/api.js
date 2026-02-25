import { Router } from 'express';
import { nanoid } from 'nanoid';
import * as db from '../db.js';
import { cancelRunningTask } from '../queue.js';

export function createApiRouter() {
  const router = Router();

  // Create a new task
  router.post('/tasks', (req, res) => {
    const { prompt, project_dir } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (prompt.length > 10000) {
      return res.status(400).json({ error: 'prompt must be under 10,000 characters' });
    }
    if (project_dir && typeof project_dir === 'string' && !project_dir.startsWith('/')) {
      return res.status(400).json({ error: 'project_dir must be an absolute path' });
    }

    const task = db.createTask({
      id: nanoid(),
      prompt: prompt.trim(),
      projectDir: project_dir || null,
    });

    res.status(201).json(task);
  });

  // List tasks
  router.get('/tasks', (req, res) => {
    const { status, limit = '20', offset = '0' } = req.query;
    const result = db.listTasks({
      status: status || undefined,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      offset: parseInt(offset, 10) || 0,
    });
    res.json(result);
  });

  // Get a single task
  router.get('/tasks/:id', (req, res) => {
    const task = db.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // Delete a task
  router.delete('/tasks/:id', (req, res) => {
    const result = db.deleteTask(req.params.id);
    if (!result) return res.status(404).json({ error: 'Task not found' });
    if (result.error) return res.status(409).json(result);
    res.status(204).end();
  });

  // Cancel a task
  router.post('/tasks/:id/cancel', (req, res) => {
    const task = db.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.status === 'pending') {
      db.updateTask(task.id, { status: 'cancelled', completed_at: new Date().toISOString() });
      return res.json({ id: task.id, status: 'cancelled' });
    }

    if (task.status === 'running') {
      cancelRunningTask(task.id);
      return res.json({ id: task.id, status: 'cancelling' });
    }

    res.status(409).json({ error: `Cannot cancel task with status: ${task.status}` });
  });

  // Daemon status
  router.get('/status', (req, res) => {
    const stats = db.getStats();
    res.json({
      status: 'ok',
      uptime_seconds: Math.floor(process.uptime()),
      current_task: stats.running > 0 ? 'active' : null,
      queue_depth: stats.pending,
      tasks_completed: stats.completed,
      tasks_failed: stats.failed,
    });
  });

  return router;
}
