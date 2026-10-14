# Home Dashboard

Monorepo for the self-hosted home dashboard. The existing Next.js app is in `apps/web`.

## Repository layout

- `apps/web` — Next.js App Router app and UI.
- `apps/worker` — worker process; scheduled jobs can be added here.
- `packages/database` — reserved for Prisma schema, migrations, and repositories.
- `packages/integrations` — reserved for shared device and API integrations.
- `docker` — service Dockerfiles and pgAdmin setup.

The worker starts without scheduled jobs. Database models and integrations have not been implemented yet.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run typecheck` for both apps and `npm run lint` for the web app from the repository root.

## Docker Compose

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` to strong, distinct values. Use a URL-safe PostgreSQL password (letters, digits, `_`, or `-`) because Compose also uses it in `DATABASE_URL`.

```bash
cp .env.example .env
docker compose up --build -d
```

The dashboard is available at [http://localhost:3000](http://localhost:3000) and pgAdmin at [http://localhost:5050](http://localhost:5050). Sign in to pgAdmin with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from `.env`. Its Home Dashboard PostgreSQL connection is imported from `docker/pgadmin/servers.json`; the database password comes from the generated pgpass file. PostgreSQL has no host port and both web interfaces bind to localhost.

The `postgres_data` and `pgadmin_data` volumes retain data across restarts. pgAdmin imports server definitions when its data volume is first created. No Prisma migrations exist yet; when they are added, run `prisma migrate deploy` as a separate deployment step.
