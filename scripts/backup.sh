#!/bin/sh
set -eu
umask 077
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_root"
backup_dir=${BACKUP_DIRECTORY:-"$task_root/backups"}
mkdir -p "$backup_dir"
task_day=$(TZ=Europe/Kyiv date +%F)
if [ "${1:-}" = "--scheduled" ]; then
  task_clock=$(TZ=Europe/Kyiv date +%H%M)
  [ "$task_clock" -ge 330 ] || exit 0
  [ ! -f "$backup_dir/home-dashboard-$task_day.dump" ] || exit 0
fi
task_lock="$backup_dir/.backup-lock"
if ! mkdir "$task_lock" 2>/dev/null; then
  task_previous=$(cat "$task_lock/pid" 2>/dev/null || true)
  case "$task_previous" in
    ''|*[!0-9]*) exit 0 ;;
    *) if kill -0 "$task_previous" 2>/dev/null; then exit 0; fi ;;
  esac
  rm -f "$task_lock/pid"
  rmdir "$task_lock" 2>/dev/null || exit 0
  mkdir "$task_lock" 2>/dev/null || exit 0
fi
echo "$$" > "$task_lock/pid"
task_tmp="$backup_dir/.home-dashboard-$task_day-$$.tmp"
trap 'rm -f "$task_tmp" "$task_lock/pid"; rmdir "$task_lock"' EXIT HUP INT TERM
# pg_dump runs in the matching PostgreSQL image. No password is printed or passed on argv.
if [ -n "${BACKUP_CONTAINER_NAME:-}" ]; then
  docker exec "$BACKUP_CONTAINER_NAME" pg_dump -U home_dashboard -d home_dashboard --format=custom > "$task_tmp"
else
  docker compose exec -T postgres pg_dump -U home_dashboard -d home_dashboard --format=custom > "$task_tmp"
fi
test -s "$task_tmp"
if [ -n "${BACKUP_CONTAINER_NAME:-}" ]; then
  docker exec -i "$BACKUP_CONTAINER_NAME" pg_restore --list < "$task_tmp" > /dev/null
else
  docker compose exec -T postgres pg_restore --list < "$task_tmp" > /dev/null
fi
mv "$task_tmp" "$backup_dir/home-dashboard-$task_day.dump"
# Only this script's dated archives are eligible for retention; never other files.
find "$backup_dir" -type f -name 'home-dashboard-????-??-??.dump' -mtime +14 -delete
echo "Backup ready: $backup_dir/home-dashboard-$task_day.dump"
