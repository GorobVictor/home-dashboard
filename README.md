# Home Dashboard

Monorepo for the self-hosted home dashboard. The existing Next.js app is in `apps/web`.

## Repository layout

- `apps/web` — Next.js App Router app and UI.
- `apps/worker` — worker process; scheduled jobs can be added here.
- `packages/database` — Prisma schema, migrations, client, and user repository.
- `packages/integrations` — reserved for shared device and API integrations.
- `docker` — service Dockerfiles and pgAdmin setup.

The worker starts without scheduled jobs. Device and external API integrations have not been implemented yet.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run typecheck` for both apps and `npm run lint` for the web app from the repository root.

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
