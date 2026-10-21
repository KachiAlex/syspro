#!/usr/bin/env bash
# Deploy pisairtelerp to the VPS.
#
# Flow: package source → upload → server-side backup → rsync into /opt/syspro-erp
#       → docker build → tag 'patched' → compose recreate → health check.
#
# Usage:
#   scripts/deploy-vps.sh [image-tag]
#   SSH_TARGET=pisairtel-vps scripts/deploy-vps.sh depth-20261021
#
# Prerequisites:
#   - SSH alias pisairtel-vps in ~/.ssh/config (key-based)
#   - /opt/syspro-erp/.env on the server (see .env.example)
#
# The build requires DATABASE_URL as a build arg because Next.js collects
# page data (DB queries) during `next build`.
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-pisairtel-vps}"
APP_DIR="${APP_DIR:-/opt/syspro-erp}"
STAGE_DIR="${STAGE_DIR:-/root/syspro-new}"
BUILD_DATABASE_URL="${BUILD_DATABASE_URL:-postgresql://syspro:syspro_secure_pass_2026@syspro-erp-db:5432/syspro_erp}"
IMAGE_TAG="${1:-depth-$(date +%Y%m%d%H%M)}"
HEALTH_URL="${HEALTH_URL:-https://pisairtelerp.com/api/health}"

EXCLUDES=(
  --exclude=node_modules --exclude=.next --exclude=.git
  --exclude='*.tar.gz' --exclude='*.log' --exclude=.env
)

echo "==> Packaging source"
PKG=$(mktemp --suffix=.tar.gz)
tar -czf "$PKG" "${EXCLUDES[@]}" .
trap 'rm -f "$PKG"' EXIT

echo "==> Uploading to $SSH_TARGET"
scp "$PKG" "$SSH_TARGET:/root/syspro-src.tar.gz"

echo "==> Backup + extract + rsync on server"
ssh "$SSH_TARGET" bash -s <<'REMOTE'
set -euo pipefail
cp -a /opt/syspro-erp "/root/syspro-erp-backup-$(date +%Y%m%d%H%M%S)" || true
rm -rf /root/syspro-new && mkdir -p /root/syspro-new
tar -xzf /root/syspro-src.tar.gz -C /root/syspro-new
# --delete mirrors the repo exactly; .env is server-only and excluded.
rsync -a --delete \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude='*.tar.gz' --exclude='*.log' --exclude=.env \
  /root/syspro-new/ /opt/syspro-erp/
REMOTE

echo "==> Building image syspro-erp-app:$IMAGE_TAG"
ssh "$SSH_TARGET" "cd $APP_DIR && docker build \
  --build-arg DATABASE_URL='$BUILD_DATABASE_URL' \
  -t syspro-erp-app:$IMAGE_TAG ."

echo "==> Tagging 'patched' and recreating app container"
ssh "$SSH_TARGET" "docker tag syspro-erp-app:$IMAGE_TAG syspro-erp-app:patched \
  && cd $APP_DIR && docker compose up -d syspro-erp-app"

echo "==> Health check"
sleep 10
curl -fsS --connect-timeout 15 "$HEALTH_URL" && echo && echo "DEPLOY OK: $IMAGE_TAG" \
  || { echo "HEALTH CHECK FAILED — inspect: ssh $SSH_TARGET docker logs syspro-erp-app --tail 100"; exit 1; }
