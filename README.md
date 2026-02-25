# Claude Daemon

Run [Claude Code](https://claude.ai/code) as a persistent background service on your machine. Submit tasks from your phone, laptop, or any device via a mobile-friendly web UI or REST API. Get email notifications when tasks complete.

## Features

- **Remote task submission** — Send coding tasks from your phone via web UI or REST API
- **Task queue** — Tasks run one at a time, queued automatically
- **Mobile-friendly dashboard** — View task status, output, and history from any device
- **Email notifications** — Get notified when tasks complete or fail
- **Docker + Caddy** — One command to run with automatic HTTPS
- **Crash recovery** — Interrupted tasks automatically re-queue on restart
- **Token auth** — Simple bearer token authentication

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone https://github.com/vanand49d48x/claude-daemon.git
cd claude-daemon
cp .env.example .env
```

Edit `.env`:
```bash
# Generate a secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set it in .env
AUTH_TOKEN=<your-generated-token>
```

### 2. Choose Claude authentication

**Option A: Mount existing Claude config** (if you have Claude Code installed locally)
```bash
# Already configured in docker-compose.yml — it mounts ~/.claude automatically
```

**Option B: Use API key**
```bash
# Add to .env:
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Start

```bash
docker compose up --build -d
```

### 4. Open the dashboard

```
https://localhost/?token=YOUR_AUTH_TOKEN
```

To access from your phone on the same Wi-Fi:
```
https://YOUR_LAPTOP_IP/?token=YOUR_AUTH_TOKEN
```

Find your laptop IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)

## Quick Start (Without Docker)

```bash
cd claude-daemon
npm install
cp .env.example .env
# Edit .env with your AUTH_TOKEN
npm start
```

Then open `http://localhost:3456/?token=YOUR_AUTH_TOKEN`

### Run as macOS service

```bash
# Install (starts on login, auto-restarts)
./scripts/install-service.sh

# Uninstall
./scripts/uninstall-service.sh
```

## API

All endpoints require authentication via `Authorization: Bearer <token>` header.

### Submit a task

```bash
curl -X POST https://localhost/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Fix the login bug in src/auth.js", "project_dir": "/projects/myapp"}'
```

### List tasks

```bash
curl https://localhost/api/tasks?status=completed \
  -H "Authorization: Bearer $TOKEN"
```

### Get task detail

```bash
curl https://localhost/api/tasks/TASK_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Cancel a task

```bash
curl -X POST https://localhost/api/tasks/TASK_ID/cancel \
  -H "Authorization: Bearer $TOKEN"
```

### Daemon status

```bash
curl https://localhost/api/status \
  -H "Authorization: Bearer $TOKEN"
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
| `PORT` | `3456` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `AUTH_TOKEN` | (required) | Authentication token |
| `DEFAULT_PROJECT_DIR` | `/projects` | Default working directory for tasks |
| `MAX_TURNS` | `50` | Max Claude turns per task |
| `TASK_TIMEOUT_MS` | `1800000` | Task timeout (30 min) |
| `DB_PATH` | `/data/daemon.db` | SQLite database path |
| `DAEMON_DOMAIN` | `localhost` | Domain for Caddy HTTPS |
| `PROJECTS_DIR` | `.` | Host directory to mount as /projects |

## Architecture

```
Phone/Browser ──HTTPS──> Caddy ──HTTP──> Express App
                                            ├── Auth middleware
                                            ├── REST API
                                            ├── Web UI
                                            └── Queue Runner
                                                 └── spawns claude -p
                                                      └── SQLite (task storage)
```

- Tasks are stored in SQLite and processed one at a time
- The queue runner polls every 2 seconds for new tasks
- Each task spawns `claude -p "prompt" --output-format json`
- On crash/restart, any running tasks are re-queued automatically

## License

MIT
