import { spawn } from 'node:child_process';
import * as db from './db.js';
import { sendNotification } from './services/notifier.js';

let running = false;
let currentProcess = null;
let currentTaskId = null;
let intervalId = null;

export function startQueueRunner(config) {
  intervalId = setInterval(() => tick(config), 2000);
  console.log('[queue] Runner started (polling every 2s)');
}

async function tick(config) {
  if (running) return;

  const task = db.getNextPending();
  if (!task) return;

  running = true;
  currentTaskId = task.id;

  console.log(`[queue] Starting task ${task.id}: "${task.prompt.slice(0, 80)}"`);

  db.updateTask(task.id, {
    status: 'running',
    started_at: new Date().toISOString(),
  });

  try {
    const result = await runClaude(task, config);

    const status = result.exitCode === 0 ? 'completed' : 'failed';
    db.updateTask(task.id, {
      status,
      output: result.stdout,
      error: result.exitCode === 0 ? null : (result.stderr || null),
      exit_code: result.exitCode,
      session_id: result.sessionId,
      tokens_used: result.tokensUsed,
      cost_usd: result.costUsd,
      completed_at: new Date().toISOString(),
    });

    console.log(`[queue] Task ${task.id} ${status}`);
    await sendNotification(task.id, config);
  } catch (err) {
    db.updateTask(task.id, {
      status: 'failed',
      error: err.message,
      completed_at: new Date().toISOString(),
    });

    console.log(`[queue] Task ${task.id} failed: ${err.message}`);
    await sendNotification(task.id, config);
  } finally {
    running = false;
    currentProcess = null;
    currentTaskId = null;
  }
}

function runClaude(task, config) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', task.prompt,
      '--output-format', 'json',
      '--max-turns', String(config.maxTurns),
    ];

    const cwd = task.project_dir || config.defaultProjectDir;

    const child = spawn(config.claudePath, args, {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    currentProcess = child;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
    }, config.taskTimeoutMs);

    child.on('close', (exitCode) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error(`Task timed out after ${config.taskTimeoutMs / 1000}s`));
        return;
      }

      let sessionId = null;
      let tokensUsed = null;
      let costUsd = null;
      let resultText = stdout;

      try {
        const json = JSON.parse(stdout);
        sessionId = json.session_id || null;
        if (json.result) resultText = json.result;
        if (json.usage) {
          tokensUsed = (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0);
        }
        if (json.cost_usd !== undefined) costUsd = json.cost_usd;
      } catch {
        // stdout wasn't valid JSON — keep raw text
      }

      resolve({
        stdout: resultText,
        stderr,
        exitCode: exitCode ?? 1,
        sessionId,
        tokensUsed,
        costUsd,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export function cancelRunningTask(taskId) {
  if (currentTaskId === taskId && currentProcess) {
    console.log(`[queue] Cancelling task ${taskId}`);
    currentProcess.kill('SIGTERM');
    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) {
        currentProcess.kill('SIGKILL');
      }
    }, 5000);
  }
}

export function stopQueueRunner() {
  return new Promise((resolve) => {
    clearInterval(intervalId);
    if (currentProcess) {
      console.log('[queue] Stopping current task...');
      currentProcess.kill('SIGTERM');
      setTimeout(() => {
        if (currentProcess && !currentProcess.killed) {
          currentProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    } else {
      resolve();
    }
  });
}
