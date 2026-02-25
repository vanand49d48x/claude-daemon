#!/bin/bash
set -e

PLIST_NAME="com.user.claude-daemon.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_NAME}"
NODE_PATH="$(which node)"

mkdir -p "$HOME/.claude-daemon"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.claude-daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${SCRIPT_DIR}/src/daemon.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${SCRIPT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/.claude-daemon/daemon.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/.claude-daemon/daemon.stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
</dict>
</plist>
EOF

launchctl load "$PLIST_DST"
echo "Claude Daemon installed and started."
echo "Logs: ~/.claude-daemon/daemon.stdout.log"
