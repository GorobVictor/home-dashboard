# Dashboard improvements (October 2026)

The dashboard now separates current telemetry from cached historical summaries.
`GET /api/marstek/live` reads only latest measurements. Historical routes use
transactionally maintained minute aggregates, retain nulls and outage boundaries,
and cache only sampled chart data and summaries for 60 seconds. The single worker
backfills existing history one hour at a time, with a durable checkpoint. Raw rows
and minute aggregates retain the existing 90-day policy. Retention runs at startup
and at 03:17 UTC in bounded batches, yielding between batches and stopping safely.

Energy includes temperature charts, peak power, coverage of valid power readings
(one expected sample per second), daily totals in Europe/Kyiv, comparison with the
preceding available period, and CSV export. All estimates are approximate. Reserve
runtime uses a five-minute average and assumes remaining energy scales with SOC.
Details expire after three minutes of unsuccessful optional RPCs; the latest
successful details timestamp is available on the temperature indicator. Unknown
power never becomes measured zero and never participates in interval integration.

Live updates reconnect, refresh on focus/reconnect, and retain a periodic fallback.
Telemetry notifications no longer refresh unrelated pages. Sockets expire with
the JWT, recheck user existence, check pong replies and disconnect slow consumers.
Login has bounded process-local account/IP throttles and a concurrency limit; the
custom server overwrites the internal IP header. Reverse proxies should replace
forwarded headers and restrict direct access as appropriate for their deployment.
`npm run dev` uses the custom server too, including Next's development HMR handler.

New pages:

- `/notifications`: paginated personal inbox, unread filter and direct project/device links.
- `/status`: job heartbeat/last success, device freshness, database size and delivery backlog.
- `/settings/sites`: shared HTTPS links, groups and ordering; it never contacts target services.

Project notes, saved/hidden/viewed state and the new workflow statuses remain personal.
Content filters affect future notifications; workflow filters affect the list only.
Freelancehunt catch-up uses bounded pages with transactionally saved progress, silent
initial baselines and Retry-After. Ordinary project failures do not block threads;
provider-wide rate limiting pauses both streams. Category backfill uses short
transactions and skips complete rows when the catalogue is unchanged.

Channel event choices include only implemented automatic producers. Unsupported event
filters are rejected by the API. Removal migrations preserve mixed selections, disable
channels that would otherwise become unfiltered, and preserve immutable history.

Telegram rules add event/device selection, Kyiv quiet hours and an opt-in daily
summary for yesterday, scheduled at 09:00 Europe/Kyiv in addition to individual
notifications. Enabling a digest never suppresses matching individual events.
Critical matching events bypass quiet hours. A startup catch-up and permanent deduplication key avoid
repeating yesterday's digest. Tests bypass filtering/quiet hours. Existing channels
keep their saved filters and quiet hours. No bot token enters the database or browser. Inline help across settings, filters,
charts, telemetry, sites, inbox and status supports hover, keyboard focus and touch.

## Backups

Run `sh scripts/backup.sh` on the Docker host to create a private custom-format
archive in `backups/`; archives are excluded from Git and Docker build contexts.
`BACKUP_DIRECTORY` can select a private destination. Archives older than 14 days
are removed only by this script's dated filename pattern. Copy backups to a
separate storage device for protection against host disk loss.

`sh scripts/verify-backup.sh backups/home-dashboard-YYYY-MM-DD.dump` restores into
a newly created disposable database and removes only that database afterward.
It never restores over the application's database.

`sh scripts/install-backup-schedule.sh` installs a macOS LaunchAgent checking every
15 minutes: one backup per Kyiv day after 03:30, with catch-up after wake. On Linux
it prints the equivalent crontab entry for the Docker host. The host and Docker
must be running for backups to execute. On macOS the installer copies a standalone
runner to `~/Library/Application Support/Home Dashboard Backups/`; its private
`backups/` directory holds scheduled archives and logs. It uses the existing
PostgreSQL container name and never reads the protected Documents checkout or `.env`
in the background. Re-run the installer after updating backup scripts or changing
the Compose project/container name. Manual archives remain in the checkout's `backups/`.

## Verification

- `npm test`: offline unit tests; no device or external credentials required.
- `TEST_DATABASE_ADMIN_URL=... npm run test:integration`: creates disposable databases,
  applies all migrations, runs SQL/integration tests and drops those databases.
  Never point this at a production database server.
- `npm run build`, then `TEST_DATABASE_ADMIN_URL=... npm run test:e2e`: synthetic users,
  an isolated web server and browser checks. Install Playwright as temporary test
  tooling or set `PLAYWRIGHT_MODULE` to an existing installation. An installed
  Chromium browser can be selected with `CHROME_EXECUTABLE`.
- `postman simulation run postman/simulations/freelancehunt.sim.yaml --port 4900 --output ndjson`,
  then `node --import tsx scripts/test-upstream.mts`: real HTTP pagination/429 checks
  against local contract fixtures. No shared Postman resources are published.
- `.github/workflows/ci.yml` runs types, lint, disposable SQL tests, builds and browser
  scenarios; screenshots are retained as CI artifacts.

The local API additions and input bounds are documented in [api.md](api.md).
