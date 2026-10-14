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
docker compose build web worker
docker compose run --rm setup
docker compose up -d
```

The `setup` command deliberately applies committed migrations and creates the initial user. It does not reset an existing user's password. To add another user, set different `INITIAL_USER_*` values and run `docker compose run --rm setup` again. Remove `INITIAL_USER_PASSWORD` from `.env` after use. For later schema deployments without creating a user, run `docker compose run --rm migrate`. The underlying migration command is `npm run db:migrate` inside a container with `DATABASE_URL` set.

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

The worker polls each device once per minute, starting immediately at launch. It reads `ES.GetStatus`, `Bat.GetStatus`, and `ES.GetMode` over unicast UDP; it sends no control commands. A failed optional battery or mode query does not discard valid energy-system data. Device IDs stay stable so historical data remains attached when names or IP addresses change. Removed devices remain in the database with their history but are marked disabled.

Measurements use UTC timestamps; power is in W, battery temperature in °C, capacity and energy in Wh, and SOC in %. Charging and discharging energy are estimated from adjacent power samples, with gaps over five minutes excluded. Some firmware omits `bat_power`; the dashboard then estimates battery power from solar, grid, and backup power and labels its source. Historical samples are retained for 90 days. The dashboard marks a device offline after three minutes without a reading and provides 24-hour and 7-day charts. Only one worker replica should run, because the scheduler uses process-local non-overlap protection.
