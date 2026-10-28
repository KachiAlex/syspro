#!/usr/bin/env bash
# Apply pending db/migrations to the production DB over SSH.
# Tracks schema_migrations (filename + md5 checksum); skips already-applied.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in db/migrations/*.sql; do
  name=$(basename "$f")
  sum=$(md5sum "$f" | cut -d' ' -f1)
  applied=$(ssh pisairtel-vps "docker exec -i syspro-erp-db psql -U syspro -d syspro_erp -tAc \"select count(*) from schema_migrations where filename='$name'\"" 2>/dev/null | tr -d '[:space:]')
  if [ "$applied" = "0" ]; then
    echo ">> applying $name"
    ssh pisairtel-vps "docker exec -i syspro-erp-db psql -U syspro -d syspro_erp" < "$f" || { echo "FAILED $name"; exit 1; }
    ssh pisairtel-vps "docker exec -i syspro-erp-db psql -U syspro -d syspro_erp -c \"insert into schema_migrations (filename, checksum) values ('$name', '$sum')\""
    echo "   ok"
  else
    echo "   skip $name (applied)"
  fi
done
