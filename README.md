# Home Dashboard

Monorepo for the self-hosted home dashboard. The existing Next.js app is in `apps/web`.

## Repository layout

- `apps/web` — Next.js App Router app and UI.
- `apps/worker` — worker process; scheduled jobs can be added here.
- `packages/database` — Prisma schema, migrations, client, and user repository.
- `packages/integrations` — shared local Marstek UDP client and response validation.
- `docker` — service Dockerfiles and pgAdmin setup.

The worker polls configured Marstek batteries. Other device and external API integrations have not been implemented yet.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run typecheck` for both apps and `npm run lint` for the web app from the repository root.

For local telemetry development, set `DATABASE_URL` and `MARSTEK_DEVICES` in `.env`, apply migrations with `npm run db:migrate`, and run `npm run dev:worker` in another terminal. The Docker Compose setup below is the easiest way to run PostgreSQL and the full stack.

## Docker Compose

Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`, and `AUTH_JWT_SECRET` to strong, distinct values. Generate the JWT secret with `openssl rand -base64 48`. Use a URL-safe PostgreSQL password (letters, digits, `_`, or `-`) because Compose also uses it in `DATABASE_URL`. Set `INITIAL_USER_FIRST_NAME`, `INITIAL_USER_LAST_NAME`, `INITIAL_USER_LOGIN`, and `INITIAL_USER_PASSWORD` for the first user. The password must contain 12–128 characters; the login must contain 3–50 lowercase letters, digits, `.`, `_`, or `-`.

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm setup
```

Compose runs the migration service after PostgreSQL is healthy and before starting web or worker. The `setup` command creates the initial user after migrations complete. It does not reset an existing user's password. To add another user, set different `INITIAL_USER_*` values and run `docker compose run --rm setup` again. Remove `INITIAL_USER_PASSWORD` from `.env` after use. For later schema deployments without creating a user, run `docker compose run --rm migrate`. The underlying migration command is `npm run db:migrate` inside a container with `DATABASE_URL` set.

The dashboard is available at [http://localhost:3000](http://localhost:3000) and pgAdmin at [http://localhost:5050](http://localhost:5050). Sign in to pgAdmin with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from `.env`. Its Home Dashboard PostgreSQL connection is imported from `docker/pgadmin/servers.json`; the database password comes from the generated pgpass file. PostgreSQL has no host port and both web interfaces bind to localhost.

Dashboard users sign in with their seeded login and password. There is no public registration endpoint. Passwords are stored as scrypt hashes, and the eight-hour JWT session is held in an HttpOnly cookie. The `postgres_data` and `pgadmin_data` volumes retain data across restarts. pgAdmin imports server definitions when its data volume is first created.

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
