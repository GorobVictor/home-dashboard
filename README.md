# Home Dashboard

Monorepo for the self-hosted home dashboard, with an authenticated Next.js app, PostgreSQL storage, and a background worker.

## Repository layout

- `apps/web` — Next.js App Router app and UI.
- `apps/worker` — Marstek and Freelancehunt polling jobs.
- `packages/database` — Prisma schema, migrations, client, and user repository.
- `packages/integrations` — shared Marstek UDP and Freelancehunt/Telegram clients with response validation.
- `docker` — service Dockerfiles.

The dashboard includes Marstek energy telemetry and Freelancehunt project/message monitoring, with optional Telegram notifications. See [AGENTS.md](AGENTS.md) for the architecture, security boundaries, and operating details.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run typecheck` for both apps and `npm run lint` for the web app from the repository root.

For local telemetry development, set `DATABASE_URL` and `MARSTEK_DEVICES` in `.env`, apply migrations with `npm run db:migrate`, and run `npm run dev:worker` in another terminal. The Docker Compose setup below is the easiest way to run PostgreSQL and the full stack.

## Docker Compose

Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD` and `AUTH_JWT_SECRET` to strong, distinct values. Generate the JWT secret with `openssl rand -base64 48`. Use a URL-safe PostgreSQL password (letters, digits, `_`, or `-`) because Compose also uses it in `DATABASE_URL`. Set `INITIAL_USER_FIRST_NAME`, `INITIAL_USER_LAST_NAME`, `INITIAL_USER_LOGIN`, and `INITIAL_USER_PASSWORD` for the first user. The password must contain 12–128 characters; the login must contain 3–50 lowercase letters, digits, `.`, `_`, or `-`.

The Compose stack joins an existing external Docker network named `shared`; create it once with `docker network create shared` if needed. The web service publishes `WEB_PORT` on the host interfaces (3000 by default), allowing other local applications to connect. PostgreSQL remains unpublished to host ports and is reachable through the Compose network and the trusted `shared` network alias `home-dashboard_postgres`.

```bash
cp .env.example .env
docker compose up -d --build
```

Compose waits for PostgreSQL, applies migrations, then runs `setup` automatically before starting web and worker. Setup creates the first user from `INITIAL_USER_*` only when the users table is empty. Existing installations skip initial setup even after those credentials are removed; account passwords are never reset. Invalid initial credentials stop a fresh installation with an explicit setup error.

For a separate configuration file, use the same file on every Compose command, for example `docker compose --env-file ~/Envs/HomeDashboard.env up --build --detach --remove-orphans`. Compose passes the initial-user settings and database connection to setup; the file does not need a separate `DATABASE_URL`. Direct `npm run db:create-user` commands require `DATABASE_URL` in their own environment.

To add another user, set `INITIAL_USER_*` and run `docker compose --env-file ~/Envs/HomeDashboard.env run --rm setup npm run db:create-user` (omit `--env-file` when using the repository `.env`). The explicit command enables manual creation even in an initialized database. Remove `INITIAL_USER_PASSWORD` from the env file after use. For schema-only deployments, run `docker compose run --rm migrate` with the same env file.

The dashboard is available at [http://localhost:3000](http://localhost:3000) with the default `WEB_PORT`. PostgreSQL has no host port.

The **Мої сайти** tab links to Timeflow API, Timeflow, Portainer, Torrent, Plex, pgAdmin and Redis through their public HTTPS domains. Each service opens in a new browser tab. pgAdmin is hosted in a separate Compose stack.

Dashboard users sign in with their seeded login and password. There is no public registration endpoint. Passwords are stored as scrypt hashes, and the eight-hour JWT session is held in an HttpOnly cookie. The `postgres_data` volume retains database data across restarts.

## Marstek Venus E 3.0

Enable **Local API** in the Marstek app and allow UDP traffic from the Docker host to each battery. `.env.example` configures the first battery at `192.168.3.224:30000`. Add more devices to the `MARSTEK_DEVICES` JSON array with unique, stable IDs:

```dotenv
MARSTEK_DEVICES='[{"id":"venus-e3-1","name":"Living room","host":"192.168.3.224","port":30000},{"id":"venus-e3-2","name":"Garage","host":"192.168.3.225","port":30000}]'
```

After changing this configuration or updating the app, rebuild the images and apply the committed migration before starting the worker:

```bash
docker compose build web worker
docker compose run --rm migrate
docker compose up -d
```

The worker attempts `ES.GetStatus` for each device once per second, starting immediately at launch, without overlapping cycles. If a device is slow or does not answer, the next cycle starts after the current one finishes. It reads the slower optional `Bat.GetStatus` and `ES.GetMode` once per minute and reuses their latest values between reads. All requests use unicast UDP and send no control commands. A failed optional query does not discard valid energy-system data. The dashboard refreshes over an authenticated WebSocket when a new reading is saved, with periodic refresh as a fallback. Device IDs stay stable so historical data remains attached when names or IP addresses change. Removed devices remain in the database with their history but are marked disabled.

Measurements use UTC timestamps; power is in W, battery temperature in °C, capacity and energy in Wh, and SOC in %. Charging and discharging energy are estimated from adjacent power samples, with gaps over five minutes excluded. Some firmware omits `bat_power`; the dashboard then estimates battery power from solar, grid, and backup power and labels its source. Historical samples are retained for 90 days. The dashboard offers 1-hour, 6-hour, 24-hour, 7-day, 30-day, and custom date-range views (up to 90 days), aggregating measurements into one-minute or ten-minute buckets. It estimates time to empty from current discharge power and remaining capacity. Devices appear offline after three minutes without a reading. Only one worker replica should run, because the scheduler uses process-local non-overlap protection.

## Freelancehunt monitoring

Set `FREELANCEHUNT_API_TOKEN` in `.env` to load the skill list and let the worker poll Freelancehunt. Optionally set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for Telegram alerts. After applying migrations and starting the stack, open **Settings** in the dashboard to enable project and unread-message monitoring, choose project skills, set the polling interval (10–3,600 seconds; default 60), and toggle Telegram notifications. The Freelancehunt tab lists projects in pages and opens full descriptions in a dialog. The first poll saves current results as a baseline; notifications are sent for later discoveries. New projects and unread messages also appear as dashboard notifications over the authenticated WebSocket.

The Freelancehunt tab also has personal budget/currency, skill/category, keyword, UTC publication-date and project-state filters. Filters and up to 30 named presets persist in PostgreSQL. Local filters only search synchronized projects, while **Settings** still controls upstream skill selection. Categories are groups from the live skills catalogue; the worker refreshes the catalogue daily and restores category/skill metadata for older projects. Budget sorting groups currencies before sorting amounts; no exchange-rate conversion is performed.

Each user has independent saved/hidden/viewed state and notes. Hidden projects appear in the Hidden filter; New means not yet viewed by that user. Personal inbox/toast notifications follow the saved content filters (budget, currency, skills, categories, words and publication dates). Saved/viewed/hidden list state does not suppress new-project notifications. Telegram channels receive collected projects according to their source/severity filters and the Telegram master switch. Changes apply only to future discoveries; immutable events remain in the event log. Projects have no scores or ranking rules.

Opening a project immediately shows its synchronized data, marks it viewed, and separately requests current details through the authenticated server API. These live details are never written to PostgreSQL. Loading/errors preserve the synchronized description; a retry is available. The API token stays server-side, and descriptions are rendered as plain text.

Repository integration tests require a fresh disposable database whose name ends in `_freelancehunt_test`, supplied through `FREELANCEHUNT_TEST_DATABASE_URL`; apply committed migrations first and run `node --import tsx --test packages/database/src/freelancehunt.integration.test.ts`. Default tests do not require a database.

Container monitoring and control are managed separately in Portainer. The dashboard does not access the Docker socket. The removal migration drops Docker telemetry/action tables and cancels obsolete deliveries while preserving other data and the immutable event history.

## Events and notifications

The dashboard bell shows a personal inbox; read status belongs to the signed-in user. Open `/events` for the immutable event log with source, type, severity and UTC date filters (`GET /api/events/list`); `/api/events` remains reserved for WebSocket upgrades. `/settings/notifications` manages shared Telegram destinations, source filters, enable/disable switches and minimum severity (`info`, `warning`, `error`, `critical`). Any authenticated local user can manage these household channels and view delivery history. Tests bypass channel filters, require an enabled saved channel, and are limited to one per user every 30 seconds.

Set `TELEGRAM_BOT_TOKEN` only in the worker environment, add the bot to the destination chat, and configure chat IDs in the UI. Existing `TELEGRAM_CHAT_ID` is imported once as a Freelancehunt-only channel; later UI settings take precedence. The Freelancehunt Telegram switch still gates newly generated Freelancehunt deliveries. Tokens never enter the database or browser. Editing/disabling a channel cancels its pending deliveries, preserving their history; a request already in flight may complete.

Events and pending notifications are persisted together. The existing single worker checks for deliveries every two seconds, with at most six attempts, exponential delays starting at five seconds, and Telegram `retry_after` support. A two-minute lease recovers interrupted attempts after restart; the interrupted attempt remains in history as `unknown`. Missing bot configuration leaves pending work untouched. Sent notifications are never deliberately sent again, but Telegram cannot guarantee exactly-once delivery after an ambiguous network failure. External HTTP runs outside database transactions.

Telegram notifications use HTML formatting with event-specific headings, readable Ukrainian severity labels, and timestamps in `Europe/Kyiv` (labelled Kyiv, with automatic daylight-saving adjustment). Project alerts include the available budget and a named Freelancehunt link; battery, device and service alerts show relevant details from the saved event. Dynamic values are escaped and bounded before HTML is assembled; arbitrary event payload fields are never included. Link previews stay disabled. The **Test** action in notification settings uses the same formatting and delivery path.

Automatic events cover low/recovered/full battery, offline/online Marstek devices, new Freelancehunt projects/unread messages, and Freelancehunt service failure/recovery after three failed cycles. First observations establish baselines; initial long-offline devices still generate an alert. `MARSTEK_LOW_BATTERY_PERCENT` defaults to 20 (range 1–90); recovery is five points higher. Full-charge detection rearms below 98%. Confirmed grid transition support is provided through `observeMarstekGrid()`, but automatic `marstek.grid_lost`/`marstek.grid_restored` detection remains unavailable: the current Venus E3 UDP RPCs expose grid power, not grid availability. Zero watts and CT disconnection are not reliable outage signals. See the [manufacturer's protocol](https://static-eu.marstekenergy.com/ems/resource/agreement/MarstekDeviceOpenApi.pdf).

Shared database exports `publishEvent()` and `observeEvent()` support permanent deduplication keys, configurable deduplication windows and durable transition observations with optional cooldowns. New event producers must pass only bounded, non-secret domain data. `notifications.changed` uses the existing PostgreSQL/WebSocket invalidation path, with a 30-second inbox polling fallback. No automation engine or extra service is introduced.

Run `npm test`, `npm run typecheck` and `npm run lint`. Repository integration tests are opt-in with `EVENTS_TEST_DATABASE_URL`, whose database name must end in `_events_test`; use a fresh disposable database with all migrations applied. They never send Telegram messages or access a physical battery. Never point this variable at the application database.
