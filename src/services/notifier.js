import nodemailer from 'nodemailer';
import { getTask, updateTask } from '../db.js';

let transporter = null;
let notifyTo = '';

export function initNotifier(config) {
  if (!config.emailEnabled) {
    console.log('[notifier] Email notifications disabled');
    return;
  }

  if (!config.smtpUser || !config.smtpPass || !config.notifyTo) {
    console.warn('[notifier] Email enabled but SMTP credentials missing — skipping');
    return;
  }

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  notifyTo = config.notifyTo;
  console.log(`[notifier] Email notifications enabled, sending to ${notifyTo}`);
}

export async function sendNotification(taskId, config) {
  if (!transporter) return;

  try {
    const task = getTask(taskId);
    if (!task || task.notified) return;

    const statusLabel = task.status === 'completed' ? 'Completed' : 'Failed';
    const subject = `[Claude Daemon] ${statusLabel}: ${task.prompt.slice(0, 60)}`;

    const dur = computeDuration(task.started_at, task.completed_at);

    const outputPreview = task.output
      ? task.output.slice(0, 3000) + (task.output.length > 3000 ? '\n\n... (truncated — view full output in dashboard)' : '')
      : '(no output)';

    const body = [
      `Task: ${task.prompt}`,
      `Status: ${task.status}`,
      `Project: ${task.project_dir || '(default)'}`,
      `Duration: ${dur}`,
      task.tokens_used ? `Tokens: ${task.tokens_used.toLocaleString()}` : '',
      task.cost_usd ? `Cost: $${task.cost_usd.toFixed(4)}` : '',
      '',
      '--- Output ---',
      outputPreview,
      task.error ? `\n--- Error ---\n${task.error.slice(0, 1000)}` : '',
    ].filter(Boolean).join('\n');

    await transporter.sendMail({
      from: config.smtpUser,
      to: notifyTo,
      subject,
      text: body,
    });

    updateTask(taskId, { notified: 1 });
    console.log(`[notifier] Email sent for task ${taskId}`);
  } catch (err) {
    console.error(`[notifier] Failed to send email for task ${taskId}: ${err.message}`);
  }
}

function computeDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}
