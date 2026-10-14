# Home Dashboard

Monorepo for the self-hosted home dashboard. The existing Next.js app is in `apps/web`.

## Repository layout

- `apps/web` — Next.js App Router app and UI.
- `apps/worker` — reserved for scheduled jobs.
- `packages/database` — reserved for Prisma schema, migrations, and repositories.
- `packages/integrations` — reserved for shared device and API integrations.
- `docker` — reserved for service Dockerfiles.

The reserved directories contain no services yet. Add implementation there when those features are built.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run typecheck` and `npm run lint` from the repository root for web checks.
