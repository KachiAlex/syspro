#!/usr/bin/env bash
# syspro-erp nightly DB backup: pg_dump → local retention → optional R2 upload.
#
# Cron (host crontab): 30 2 * * * /opt/syspro-erp/cron/backup-db.sh
#
# This file lives INSIDE the repo so the deploy rsync keeps it present —
# the original server-only copy was wiped by rsync --delete on 2026-10-21
# and nightly backups silently stopped (discovered 2026-11-02).
#
# Off-site upload is enabled by setting these in /opt/syspro-erp/.env:
#   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
#   R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
#   R2_BUCKET=syspro-erp-backups
set -uo pipefail

APP_DIR="/opt/syspro-erp"
OUT_DIR="/root/db-backups"
DB_CONTAINER="syspro-erp-db"
DB_USER="syspro"
DB_NAME="syspro_erp"
LOCAL_RETENTION_DAYS=14
REMOTE_RETENTION_KEEP=30

mkdir -p "$OUT_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$OUT_DIR/syspro_erp-$TS.sql.gz"

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUT"
rc=$?
if [ $rc -ne 0 ] || [ ! -s "$OUT" ]; then
  echo "backup-db: pg_dump failed (rc=$rc) — $OUT" >&2
  [ -x "$APP_DIR/cron/send-alert.py" ] && "$APP_DIR/cron/send-alert.py" "ERP backup FAILED" "pg_dump rc=$rc" || true
  exit 1
fi

# Local retention
find "$OUT_DIR" -name 'syspro_erp-*.sql.gz' -mtime +"$LOCAL_RETENTION_DAYS" -delete
echo "backup-db: wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Optional off-site upload to Cloudflare R2 (S3-compatible, free egress).
# No-ops cleanly when R2_* vars are absent.
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ] && command -v rclone >/dev/null 2>&1; then
  set -a; . "$ENV_FILE" 2>/dev/null || true; set +a
  if [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && [ -n "${R2_ENDPOINT:-}" ]; then
    BUCKET="${R2_BUCKET:-syspro-erp-backups}"
    export RCLONE_CONFIG_R2_TYPE=s3 \
           RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
           RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
           RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
           RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT" \
           RCLONE_CONFIG_R2_ACL=private
    KEY="nightly/$(basename "$OUT")"
    if rclone copyto "$OUT" "r2:$BUCKET/$KEY" --s3-upload-cutoff 50M 2>&1; then
      echo "backup-db: uploaded to r2:$BUCKET/$KEY"
      # Remote retention: keep newest REMOTE_RETENTION_KEEP nightly objects.
      rclone lsf "r2:$BUCKET/nightly/" --files-only 2>/dev/null | sort -r \
        | tail -n "+$((REMOTE_RETENTION_KEEP + 1))" \
        | while read -r old; do rclone deletefile "r2:$BUCKET/nightly/$old" 2>/dev/null || true; done
    else
      echo "backup-db: R2 upload failed (local copy kept)" >&2
      [ -x "$APP_DIR/cron/send-alert.py" ] && "$APP_DIR/cron/send-alert.py" "ERP off-site backup failed" "rclone upload to r2:$BUCKET failed" || true
    fi
  fi
fi
