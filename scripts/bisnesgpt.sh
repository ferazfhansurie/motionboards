#!/bin/bash
# Control script for the BisnesGPT server (remote).
#
# SSH access is configured in ~/.ssh/config.
# Two host entries are available:
#   - bisnesgpt-remote       (uses IdentityFile ~/.ssh/id_ed25519_bisnesgpt)
#   - ssh.jutateknologi.com  (user firaz, ProxyCommand `cloudflared access ssh`)
# Set HOST below to whichever you prefer.
# Manual form:  ssh firaz@ssh.jutateknologi.com
#
# Usage:
#   ./scripts/bisnesgpt.sh ssh                    # interactive shell
#   ./scripts/bisnesgpt.sh status                 # pm2 list
#   ./scripts/bisnesgpt.sh logs <process> [lines] # pm2 logs (default 100 lines)
#   ./scripts/bisnesgpt.sh restart <process>      # pm2 restart <process>
#   ./scripts/bisnesgpt.sh restart-all            # pm2 restart all
#   ./scripts/bisnesgpt.sh push <local> <remote>  # scp a file to the server
#   ./scripts/bisnesgpt.sh pull <remote> <local>  # scp a file from the server
#   ./scripts/bisnesgpt.sh run '<cmd>'            # run an arbitrary command
#
# The remote project lives at ~/backend/bisnesgpt-server on the server.
set -e

HOST="${BISNESGPT_HOST:-bisnesgpt-remote}"
SSH_OPTS=(-o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new)
REMOTE_DIR="/home/firaz/backend/bisnesgpt-server"

case "${1:-}" in
  ssh)
    ssh "$HOST"
    ;;
  status)
    ssh "$HOST" "pm2 list"
    ;;
  logs)
    proc="${2:?process name required}"
    lines="${3:-100}"
    ssh "$HOST" "pm2 logs '$proc' --lines '$lines' --nostream"
    ;;
  restart)
    proc="${2:?process name required}"
    ssh "$HOST" "pm2 restart '$proc'"
    ;;
  restart-all)
    ssh "$HOST" "pm2 restart all"
    ;;
  push)
    local_path="${2:?local path required}"
    remote_path="${3:?remote path required}"
    scp "$local_path" "$HOST:$remote_path"
    ;;
  pull)
    remote_path="${2:?remote path required}"
    local_path="${3:?local path required}"
    scp "$HOST:$remote_path" "$local_path"
    ;;
  run)
    cmd="${2:?command required}"
    ssh "$HOST" "$cmd"
    ;;
  *)
    sed -n '2,22p' "$0"
    exit 1
    ;;
esac
