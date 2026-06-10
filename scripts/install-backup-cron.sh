#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/wielka-liga-typerow}"
CRON_LINE="0 3 * * * cd ${APP_DIR} && /bin/sh scripts/backup-db.sh >> /var/log/wlt-backup.log 2>&1"

chmod +x "${APP_DIR}/scripts/backup-db.sh"

(crontab -l 2>/dev/null | grep -v 'scripts/backup-db.sh'; echo "${CRON_LINE}") | crontab -

echo "Cron backupu ustawiony na 03:00 codziennie."
echo "${CRON_LINE}"
