# Claude Daemon

Run [Claude Code](https://claude.ai/code) as a persistent background service on your machine. Submit tasks from your phone, laptop, or any device via a mobile-friendly web UI or REST API. Get email notifications when tasks complete.

Think of it as **headless Claude Code with a remote control** — assign coding tasks from your phone while your laptop does the work.

## Features

- **Remote task submission** — Send coding tasks from your phone via web UI or REST API
- **Task queue** — Tasks run one at a time, queued automatically
- **Mobile-friendly dashboard** — View task status, output, and history from any device
- **Output preview** — See Claude's response directly on the dashboard cards
- **Task detail view** — Full output with timestamps, duration, and token usage
- **Email notifications** — Get notified when tasks complete or fail
- **Docker + Caddy** — One command to run with automatic HTTPS
- **Crash recovery** — Interrupted tasks automatically re-queue on restart
- **Token auth** — Simple bearer token authentication with cookie support

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone https://github.com/vanand49d48x/claude-daemon.git
cd claude-daemon
cp .env.example .env
```

Edit `.env` and set two required values:

```bash
# Generate a secure auth token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env:
AUTH_TOKEN=<your-generated-token>
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

> **Why API key?** Claude Code on macOS stores auth in the system Keychain, which Docker containers can't access. The `ANTHROPIC_API_KEY` env var is the reliable way to authenticate inside a container.

### 2. Start

```bash
docker compose up --build -d
```

### 3. Open the dashboard

**On your laptop:**
```
http://localhost:3456/?token=YOUR_AUTH_TOKEN
```

**On your phone** (same Wi-Fi):
```
http://YOUR_LAPTOP_IP:3456/?token=YOUR_AUTH_TOKEN
```

Find your laptop IP:
```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I
```

> **Tip:** Bookmark the URL on your phone's home screen for quick access.
> - **iOS:** Share > Add to Home Screen
> - **Android:** Chrome menu > Add to Home screen

### 4. Optional: HTTPS via Caddy

The docker-compose includes a Caddy reverse proxy for HTTPS. To use it:

```
https://localhost/?token=YOUR_AUTH_TOKEN
```

Your browser will show a self-signed certificate warning on first visit — accept it to proceed. For LAN access, plain HTTP on port 3456 is simpler and works fine on a home network.

## Quick Start (Without Docker)

```bash
cd claude-daemon
npm install
cp .env.example .env
# Edit .env with your AUTH_TOKEN (and optionally ANTHROPIC_API_KEY)
npm start
```

Then open `http://localhost:3456/?token=YOUR_AUTH_TOKEN`

> **Note:** Without Docker, Claude Code can authenticate via your macOS Keychain (if you've already run `claude` and logged in), so `ANTHROPIC_API_KEY` is optional.

### Run as macOS background service

```bash
# Install (starts on login, auto-restarts on crash)
./scripts/install-service.sh

# Uninstall
./scripts/uninstall-service.sh

# View logs
tail -f ~/.claude-daemon/daemon.stdout.log
```

## How It Works

1. You open the web UI on your phone and type a task (e.g. "Fix the login bug in src/auth.js")
2. The daemon queues the task in SQLite
3. The queue runner picks it up and spawns `claude -p "your prompt" --output-format json`
4. Claude Code executes the task in the specified project directory
5. Output is captured and stored in the database
6. The web UI auto-refreshes every 3 seconds to show progress
7. Optionally, an email notification is sent when the task completes

## Web UI

### Dashboard
- Submit new tasks with a prompt and optional project directory
- Filter tasks by status (All / Pending / Running / Completed / Failed)
- Task cards show prompt, output preview, time ago, and duration
- Auto-polls every 3 seconds for live updates
- Dark mode support

### Task Detail
- Full timestamps (e.g. "Feb 25, 2026, 3:04:26 AM (5m ago)")
- Complete Claude output in a scrollable monospace block
- Token usage and cost tracking
- Cancel running tasks or delete completed ones

## API

All endpoints require authentication via `Authorization: Bearer <token>` header.

### Submit a task

```bash
curl -X POST http://localhost:3456/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Fix the login bug in src/auth.js", "project_dir": "/projects/myapp"}'
```

### List tasks

```bash
curl http://localhost:3456/api/tasks?status=completed \
  -H "Authorization: Bearer $TOKEN"
```

### Get task detail

```bash
curl http://localhost:3456/api/tasks/TASK_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Cancel a task

```bash
curl -X POST http://localhost:3456/api/tasks/TASK_ID/cancel \
  -H "Authorization: Bearer $TOKEN"
```

### Delete a task

```bash
curl -X DELETE http://localhost:3456/api/tasks/TASK_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Daemon status

```bash
curl http://localhost:3456/api/status \
  -H "Authorization: Bearer $TOKEN"
```

Returns:
```json
{
  "status": "ok",
  "uptime_seconds": 3600,
  "current_task": null,
  "queue_depth": 0,
  "tasks_completed": 15,
  "tasks_failed": 2
}
```

## Email Notifications

To get email notifications when tasks complete:

1. Enable 2-Step Verification on your Google account
2. Generate an App Password: Google Account > Security > App Passwords
3. Add to `.env`:

```bash
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
NOTIFY_TO=your.email@gmail.com
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AUTH_TOKEN` | (required) | Authentication token for API and UI access |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (required for Docker) |
| `PORT` | `3456` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DEFAULT_PROJECT_DIR` | `/projects` | Default working directory for tasks |
| `MAX_TURNS` | `50` | Max Claude turns per task |
| `TASK_TIMEOUT_MS` | `1800000` | Task timeout in ms (default: 30 min) |
| `DB_PATH` | `/data/daemon.db` | SQLite database path |
| `DAEMON_DOMAIN` | `localhost` | Domain for Caddy HTTPS |
| `PROJECTS_DIR` | `.` | Host directory to mount as /projects in Docker |
| `EMAIL_ENABLED` | `false` | Enable email notifications |

## Architecture

```
Phone/Browser ──HTTP──> Express App (port 3456)
                          ├── Auth middleware (Bearer token + cookie)
                          ├── REST API (/api/tasks, /api/status)
                          ├── Web UI (static HTML/CSS/JS)
                          └── Queue Runner (polls every 2s)
                               └── spawns: claude -p "prompt" --output-format json
                                    └── SQLite (task persistence + crash recovery)
```

**Optional HTTPS path:**
```
Phone/Browser ──HTTPS──> Caddy (port 443) ──HTTP──> Express App (port 3456)
```

- **Single task at a time** — prevents Claude Code sessions from conflicting
- **Crash recovery** — on restart, any `running` tasks are reset to `pending` and re-executed
- **Task timeout** — configurable (default 30 min), kills runaway processes
- **Polling queue** — lightweight 2-second SQLite poll, no external message broker needed

## Project Structure

```
claude-daemon/
├── Dockerfile                # Node 22 + Claude Code CLI
├── docker-compose.yml        # App + Caddy services
├── Caddyfile                 # Reverse proxy config
├── src/
│   ├── daemon.js             # Entry point: starts server, DB, queue
│   ├── server.js             # Express app + middleware wiring
│   ├── db.js                 # SQLite schema + CRUD helpers
│   ├── queue.js              # Task queue runner + Claude CLI spawner
│   ├── routes/api.js         # REST API endpoints
│   ├── routes/ui.js          # HTML page serving
│   ├── middleware/auth.js    # Token + cookie authentication
│   ├── services/notifier.js  # Email notifications
│   └── utils/config.js       # Environment config loader
├── public/
│   ├── index.html            # Dashboard (task list + submit form)
│   ├── task.html             # Task detail page
│   ├── style.css             # Mobile-first responsive styles
│   └── app.js                # Frontend JS (fetch + polling)
└── scripts/
    ├── install-service.sh    # macOS launchd installer
    └── uninstall-service.sh  # macOS launchd uninstaller
```

## Troubleshooting

**"Not logged in" error in Docker:**
You need to set `ANTHROPIC_API_KEY` in `.env`. Docker containers can't access the macOS Keychain where Claude Code stores its auth.

**Self-signed certificate warning:**
When accessing via Caddy HTTPS, your browser will warn about the certificate. This is expected for `localhost`. Click "Advanced" > "Proceed" to continue. Alternatively, use HTTP on port 3456 directly.

**Tasks failing immediately:**
Check the container logs: `docker logs claude-daemon-app-1`

**Phone can't connect:**
Make sure your phone is on the same Wi-Fi network as your laptop. Use your laptop's local IP (not `localhost`).

## License

MIT
