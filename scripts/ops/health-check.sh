#!/bin/bash
# syspro-erp health monitor — alerts admin@pisairtel.com on state transitions.
# Checks: app health endpoint (local), public domain health, db container,
# pgBouncer container, disk usage. State lives in /var/lib/syspro-health.
# Crontab: */5 * * * * /opt/syspro-erp/cron/health-check.sh

STATE_DIR=/var/lib/syspro-health
mkdir -p "$STATE_DIR"
LOG=/var/log/syspro-health.log
SEND=/opt/syspro-erp/cron/send-alert.py

note() { echo "$(date -Is) $*" >> "$LOG"; }

# transition <name> <ok|fail> <detail>
transition() {
  local name="$1" now="$2" detail="$3"
  local file="$STATE_DIR/$name"
  local prev
  prev=$(cat "$file" 2>/dev/null || echo "ok")
  if [ "$prev" = "$now" ]; then return 0; fi
  echo "$now" > "$file"
  if [ "$now" = "fail" ]; then
    note "DOWN: $name — $detail"
    python3 "$SEND" "[syspro-erp] DOWN: $name" \
      "Check failed at $(date -Is)\n\nComponent: $name\nDetail: $detail\n\nRecovery notice will follow when it recovers." \
      || note "ALERT SEND FAILED for $name"
  else
    note "RECOVERED: $name"
    python3 "$SEND" "[syspro-erp] RECOVERED: $name" \
      "Recovered at $(date -Is)\n\nComponent: $name\nEarlier failure: $detail" \
      || note "RECOVERY SEND FAILED for $name"
  fi
}

# 1. App — local health endpoint
APP=$(curl -sf -m 15 -o /dev/null -w "%{http_code}" http://localhost:3003/api/health 2>/dev/null || echo "000")
if [ "$APP" = "200" ]; then transition app ok "http 200"; else transition app fail "health endpoint returned $APP"; fi

# 2. Public domain — end-to-end through nginx + TLS
PUB=$(curl -sf -m 15 -o /dev/null -w "%{http_code}" https://pisairtelerp.com/api/health 2>/dev/null || echo "000")
if [ "$PUB" = "200" ]; then transition public ok "http 200"; else transition public fail "public health returned $PUB (nginx/TLS/cert or upstream)"; fi

# 3. Postgres container
DB=$(docker inspect -f '{{.State.Health.Status}}' syspro-erp-db 2>/dev/null || echo "missing")
if [ "$DB" = "healthy" ]; then transition db ok "healthy"; else transition db fail "container state: $DB"; fi

# 4. pgBouncer
POOL=$(docker inspect -f '{{.State.Running}}' syspro-erp-pool 2>/dev/null || echo "missing")
if [ "$POOL" = "true" ]; then transition pool ok "running"; else transition pool fail "container state: $POOL"; fi

# 5. Disk usage on /
DISK=$(df / --output=pcent | tail -1 | tr -dc '0-9')
if [ "$DISK" -lt 90 ]; then transition disk ok "${DISK}%"; else transition disk fail "disk at ${DISK}%"; fi

exit 0
