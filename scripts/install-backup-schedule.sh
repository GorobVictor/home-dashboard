#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$(uname -s)" != Darwin ]; then
  echo "Add to the Docker host crontab: */15 * * * * /bin/sh '$task_root/scripts/backup.sh' --scheduled"
  exit 0
fi
task_label=space.gorob.home-dashboard-backup
task_file="$HOME/Library/LaunchAgents/$task_label.plist"
task_support="$HOME/Library/Application Support/Home Dashboard Backups"
task_container_id=$(cd "$task_root" && docker compose ps -q postgres)
if [ -z "$task_container_id" ]; then echo 'Start PostgreSQL before installing the backup schedule.' >&2; exit 1; fi
task_container_name=$(docker inspect --format '{{.Name}}' "$task_container_id")
task_container_name=${task_container_name#/}
mkdir -p "$HOME/Library/LaunchAgents"
# plistlib escapes paths correctly, including spaces and XML metacharacters.
python3 - "$task_root" "$task_file" "$task_label" "$task_support" "$task_container_name" <<'PY'
import os, plistlib, shutil, sys
root, output, label, support, container = sys.argv[1:]
os.makedirs(support + '/backups', mode=0o700, exist_ok=True)
os.chmod(support, 0o700)
os.chmod(support + '/backups', 0o700)
runner = support + '/backup-runner.sh'
shutil.copyfile(root + '/scripts/backup.sh', runner)
os.chmod(runner, 0o700)
with open(output, 'wb') as stream:
    plistlib.dump({'Label': label, 'ProgramArguments': ['/bin/sh', runner, '--scheduled'],
      'WorkingDirectory': support, 'StartInterval': 900, 'RunAtLoad': True,
      'EnvironmentVariables': {'PATH': '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin', 'BACKUP_DIRECTORY': support + '/backups', 'BACKUP_CONTAINER_NAME': container},
      'StandardOutPath': support + '/backups/scheduler.log', 'StandardErrorPath': support + '/backups/scheduler-error.log'}, stream)
PY
launchctl bootout "gui/$(id -u)" "$task_file" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$task_file"
echo 'Daily backups enabled after 03:30 Europe/Kyiv, with catch-up after wake and 14-day retention.'
echo "Scheduled archives: $task_support/backups"
