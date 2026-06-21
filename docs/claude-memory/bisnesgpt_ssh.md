---
name: BisnesGPT server SSH access
description: How to SSH into, push to, and restart the BisnesGPT production server from any project (pm2-managed, Cloudflare tunneled)
type: reference
originSessionId: a93f5457-c4ae-4626-bafd-7aecf090f907
---
BisnesGPT production server is reachable via SSH through a Cloudflare tunnel.

**SSH alias (configured in `~/.ssh/config`):** `bisnesgpt-remote`
- HostName: `ssh.jutateknologi.com`
- User: `firaz`
- IdentityFile: `~/.ssh/id_ed25519_bisnesgpt`
- ProxyCommand: `cloudflared access tcp --hostname %h`

Note: the `aios-terminal` deploy script (`C:\Users\user\Documents\aios-terminal\scripts\deploy-web.sh`) uses the alias `bisnesgpt` — that alias is NOT in `~/.ssh/config` as of 2026-04-22. The working alias is `bisnesgpt-remote`. If a script uses `bisnesgpt`, the user either has a different config or needs the alias added.

**Remote project path:** `~/backend/bisnesgpt-server`

**Process manager:** pm2. Restart/status/logs all go through `pm2` on the remote.

**Public URL (Cloudflare tunnel):** `bisnesgpt.jutateknologi.com` → `localhost:3000`

**Control script in motionboards:** `scripts/bisnesgpt.sh` — wraps common ops:
- `ssh`, `status` (pm2 list), `logs <proc>`, `restart <proc>`, `restart-all`, `push`, `pull`, `run '<cmd>'`

**How to apply:** When the user asks to push code or restart the BisnesGPT server from inside the motionboards (or any) project, use `bisnesgpt-remote` as the SSH host. From motionboards specifically, prefer the wrapper `scripts/bisnesgpt.sh`.

**Tunnel status (verified 2026-05-01):** SSH via cloudflared tunnel works. `bash scripts/bisnesgpt.sh status` and arbitrary `run '<cmd>'` commands succeed. The 2026-04-22 outage is resolved.

**Sandbox note:** Claude Code's sandbox flags certain remote shell calls as "Production Reads" and denies them — pm2 list, `ls`, simple file reads via `head`/`sed` go through, but DB queries via node, broad `grep -r`, and anything pulling live data into the transcript get blocked. The user must add bash permission rules in settings (e.g., `Bash(bash scripts/bisnesgpt.sh run:*)`) or grant explicit per-session authorization to unblock prod reads/writes.
