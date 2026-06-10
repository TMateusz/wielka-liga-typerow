#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/wielka-liga-typerow}"
BACKUP_DIR="${BACKUP_DIR:-/opt/wielka-liga-typerow/backups}"
CONTAINER="${CONTAINER:-wielka-liga-typerow}"
STAMP="$(date +%Y-%m-%d_%H-%M)"
TARGET="${BACKUP_DIR}/wielka-liga-typerow-${STAMP}.db"

mkdir -p "${BACKUP_DIR}"

docker exec "${CONTAINER}" cat /app/data/wielka-liga-typerow.db > "${TARGET}"

find "${BACKUP_DIR}" -name 'wielka-liga-typerow-*.db' -mtime +14 -delete

echo "Backup zapisany: ${TARGET}"
