let currentFilter = '';

// Fetch and render daemon status
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const badge = document.getElementById('daemon-status');
    badge.textContent = `Queue: ${data.queue_depth}`;
    badge.className = 'status-badge ok';
  } catch {
    const badge = document.getElementById('daemon-status');
    badge.textContent = 'Offline';
    badge.className = 'status-badge error';
  }
}

// Fetch and render task list
async function fetchTasks() {
  try {
    const params = new URLSearchParams({ limit: '50' });
    if (currentFilter) params.set('status', currentFilter);

    const res = await fetch('/api/tasks?' + params);
    const data = await res.json();
    renderTasks(data.tasks, data.total);
  } catch {
    document.getElementById('task-list').innerHTML =
      '<div class="empty-state">Failed to load tasks</div>';
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function duration(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end + 'Z') - new Date(start + 'Z');
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return m + 'm ' + rs + 's';
}

function renderTasks(tasks, total) {
  const list = document.getElementById('task-list');

  if (!tasks.length) {
    list.innerHTML = '<div class="empty-state">No tasks yet. Submit one above.</div>';
    return;
  }

  list.innerHTML = tasks.map(task => `
    <a href="/task/${task.id}" class="task-card status-${task.status}">
      <div class="task-card-header">
        <span class="task-id">#${task.id.slice(0, 8)}</span>
        <span class="task-status ${task.status}">${task.status}</span>
      </div>
      <div class="task-prompt">${escapeHtml(task.prompt)}</div>
      <div class="task-meta">
        <span>${timeAgo(task.created_at)}</span>
        ${task.status === 'running' ? '<span>Running...</span>' : ''}
        ${task.completed_at ? '<span>' + duration(task.started_at, task.completed_at) + '</span>' : ''}
        ${task.project_dir ? '<span>' + escapeHtml(task.project_dir) + '</span>' : ''}
      </div>
    </a>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Form submission
document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting...';

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: document.getElementById('prompt').value.trim(),
        project_dir: document.getElementById('project_dir').value.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to create task');
      return;
    }

    // Clear form and refresh
    document.getElementById('prompt').value = '';
    document.getElementById('project_dir').value = '';
    fetchTasks();
    fetchStatus();
  } catch (err) {
    alert('Failed to submit task: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Task';
  }
});

// Filter buttons
document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentFilter = btn.dataset.status;
  fetchTasks();
});

// Initial load
fetchStatus();
fetchTasks();

// Poll every 3 seconds
setInterval(() => {
  fetchTasks();
  fetchStatus();
}, 3000);
