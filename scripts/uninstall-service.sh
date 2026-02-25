#!/bin/bash
set -e

PLIST_DST="$HOME/Library/LaunchAgents/com.user.claude-daemon.plist"

if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Claude Daemon uninstalled."
else
  echo "Claude Daemon service not found."
fi
