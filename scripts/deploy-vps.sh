#!/usr/bin/env bash
# Deploy pisairtelerp to the VPS.
#
# Flow: package source → upload → server-side backup → rsync into /opt/syspro-erp
#       → docker build → tag 'patched' → recreate app only → health check.
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
#
# SAFETY: syspro-erp-net is external and shared with pisairtel-nginx.
# This script recreates ONLY the app container (--no-deps) and pre-flights
# the network state. Never run `docker compose down` on this project.
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-pisairtel-vps}"
APP_DIR="${APP_DIR:-/opt/syspro-erp}"
STAGE_DIR="${STAGE_DIR:-/root/syspro-new}"
BUILD_DATABASE_URL="${BUILD_DATABASE_URL:-postgresql://syspro:syspro_secure_pass_2026@syspro-erp-db:5432/syspro_erp}"
IMAGE_TAG="${1:-depth-$(date +%Y%m%d%H%M)}"
HEALTH_URL="${HEALTH_URL:-https://pisairtelerp.com/api/health}"
NET_NAME="syspro-erp_syspro-erp-net"

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
# Backup retention: keep the newest 5 deploy backups (~45MB each — unbounded
# accumulation filled the disk on 2026-10-30).
ls -1dt /root/syspro-erp-backup-* 2>/dev/null | tail -n +6 | xargs -r rm -rf
# Reclaim dangling image layers before the build so a packed disk can't
# ENOSPC mid-build (also happened 2026-10-30).
docker image prune -f >/dev/null 2>&1 || true
REMOTE

echo "==> Pre-flight: network + compose sanity"
ssh "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
# The shared network must exist and carry nginx before we touch anything.
docker network inspect $NET_NAME --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q pisairtel-nginx \
  && echo "  network OK (nginx attached)" \
  || echo "  WARN: pisairtel-nginx not attached to $NET_NAME"
# Compose file must parse and declare the net external.
cd $APP_DIR
docker compose config --quiet && echo "  compose config OK"
docker compose config | grep -A3 '^  syspro-erp-net:' | grep -q 'external: true' \
  && echo "  network declared external" \
  || { echo "  FAIL: syspro-erp-net is not external — refusing to deploy"; exit 1; }
REMOTE

echo "==> Building image syspro-erp-app:$IMAGE_TAG"
ssh "$SSH_TARGET" "cd $APP_DIR && docker build \
  --build-arg DATABASE_URL='$BUILD_DATABASE_URL' \
  -t syspro-erp-app:$IMAGE_TAG ."

echo "==> Tagging 'patched' and recreating APP ONLY (--no-deps)"
ssh "$SSH_TARGET" "docker tag syspro-erp-app:$IMAGE_TAG syspro-erp-app:patched \
  && cd $APP_DIR && docker compose up -d --no-deps syspro-erp-app"

echo "==> Post-deploy: verify network membership"
ssh "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
ATTACHED=\$(docker network inspect $NET_NAME --format '{{range .Containers}}{{.Name}} {{end}}')
echo "  on $NET_NAME: \$ATTACHED"
for c in syspro-erp-app syspro-erp-db pisairtel-nginx; do
  echo "\$ATTACHED" | grep -qw "\$c" || { echo "  FAIL: \$c detached from network"; exit 1; }
done
docker ps --format '{{.Names}}\t{{.Status}}' | grep syspro-erp
REMOTE

echo "==> Health check"
sleep 10
curl -fsS --connect-timeout 15 "$HEALTH_URL" && echo && echo "DEPLOY OK: $IMAGE_TAG" \
  || { echo "HEALTH CHECK FAILED — inspect: ssh $SSH_TARGET docker logs syspro-erp-app --tail 100"; exit 1; }

echo "==> Cleanup: old deploy tags + journal vacuum"
ssh "$SSH_TARGET" bash -s <<'REMOTE'
set -euo pipefail
# Keep 'patched' + the 2 newest depth-* tags; drop older tags and orphans.
docker images syspro-erp-app --format '{{.Tag}}' | grep '^depth-' | sort -r | tail -n +3 \
  | xargs -r -I{} docker rmi "syspro-erp-app:{}" 2>/dev/null || true
docker image prune -f >/dev/null 2>&1 || true
journalctl --vacuum-size=300M >/dev/null 2>&1 || true
REMOTE
