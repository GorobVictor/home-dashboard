#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$task_root"
task_backup=${1:?Pass a backup archive path}
test -f "$task_backup"
task_database="restore_$(date +%s)_$$"_backup_test
trap 'docker compose exec -T postgres dropdb -U home_dashboard --if-exists "$task_database" > /dev/null' EXIT HUP INT TERM
docker compose exec -T postgres createdb -U home_dashboard "$task_database"
# Deliberately restores only into a newly created disposable database.
docker compose exec -T postgres pg_restore -U home_dashboard --dbname="$task_database" --exit-on-error --no-owner < "$task_backup"
docker compose exec -T postgres psql -U home_dashboard -d "$task_database" -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS users_restored FROM users; SELECT count(*) AS migrations_restored FROM _prisma_migrations;'
echo 'Backup restored and checked in a disposable database.'
