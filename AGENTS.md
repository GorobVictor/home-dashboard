# Home Dashboard — Codex Instructions

These instructions apply to the entire repository. Follow them for every change. Do not require a separate architecture or token-efficiency skill.

## 1. Project goal and stack

Build a modular, self-hosted home dashboard that integrates local devices (including Marstek Venus E 3.0) and external APIs (such as DTEK and weather), stores measurements, displays dashboards, and runs scheduled tasks. An AI agent may be added later; do not introduce one unless requested.

- **Monorepo:** npm workspaces, TypeScript, Node.js.
- **Web + HTTP API:** Next.js App Router, React, Tailwind CSS, shadcn/ui.
- **Charts:** Recharts (prefer shadcn chart components where practical).
- **Worker:** Node.js + `node-cron`; use `tsx` for development.
- **Database:** PostgreSQL + Prisma migrations/client.
- **Runtime:** Docker Compose, with separate `web`, `worker`, and `postgres` services.

Prefer existing repository conventions over inventing new ones. Ask before introducing a major framework, service, queue, or deployment platform.

## 2. Repository boundaries

```text
apps/
  web/                       # Next.js pages, components, route handlers
  worker/                    # Scheduler bootstrap and background jobs
packages/
  database/                  # Prisma schema, migrations, client, repositories
  integrations/              # Shared Marstek/DTEK/weather/etc. clients and domain services
docker/
  web.Dockerfile
  worker.Dockerfile
docker-compose.yml
package.json                 # npm workspaces
AGENTS.md
```

Keep the repository organized around these boundaries. Create directories only when needed; do not generate empty scaffolding.

### Dependency direction

- `apps/web` -> `packages/database`, `packages/integrations`.
- `apps/worker` -> `packages/database`, `packages/integrations`.
- Shared packages must **not** import either app, React components, Next.js runtime modules, or worker entrypoints.
- `apps/web` must **not** import worker jobs or scheduling infrastructure.
- `apps/worker` must **not** import web route handlers or UI code.
- Avoid cross-package imports through source-relative paths; use workspace package exports.
- Never duplicate integration/business logic between the web API and worker.

## 3. Implementation rules

### Web (`apps/web`)

- Use Next.js App Router. Put HTTP endpoints in `app/api/**/route.ts`.
- Keep route handlers thin: validate input, authorize, call a shared service/repository, return an explicit response.
- Use Server Components by default; mark only interactive components with `"use client"`.
- Prefer shadcn/ui primitives and Tailwind tokens over custom component libraries or large amounts of one-off CSS.
- Implement accessible loading, error, and empty states; build responsive layouts and support dark mode.
- Never connect to PostgreSQL or a local device directly from browser code; use server-side APIs.
- Use Recharts for charts, with sensible sampling/pagination for historical measurements.

### Worker (`apps/worker`)

- Keep scheduling declarations in the worker; put reusable operations in shared packages.
- Jobs must be independently callable/testable, logged, bounded by timeouts, and safe to retry where possible.
- Catch and report errors per job so one failure does not terminate the scheduler.
- Prevent overlapping runs of the same job. Do not run multiple scheduler replicas without a database-backed locking/leader mechanism.
- Use `node-cron` for minute-level and coarser schedules; use an explicit managed polling loop for intervals measured in seconds.
- Do not use an LLM or an HTTP request to the web app merely to execute a local scheduled task.

### Database (`packages/database`)

- Store Prisma schema, committed migration files, Prisma client setup, and repositories here.
- Make schema changes through migrations; never rely on `prisma db push` as the production migration workflow.
- Use a single shared Prisma client per process, with clean process shutdown in the worker.
- Store time-series timestamps in UTC; document measurement units, sampling interval, and retention policy.
- Add appropriate indexes for device identifiers and timestamp-based queries.
- Keep secrets, API tokens, and passwords out of source control and database logs.

### Integrations (`packages/integrations`)

- Separate transport clients from domain services and persistence.
- Define typed request/response models; validate untrusted external API data.
- Configure URLs, device addresses, ports, credentials, timeouts, and retry limits through environment/config.
- Use bounded retries with backoff when safe; provide actionable errors and structured logs without secrets.
- For Marstek, local UDP access must run on the server/worker, never the browser. Prefer direct unicast to a configured local IP; do not assume broadcast discovery works in Docker Desktop.
- Keep any potentially dangerous device-control action explicit, validated, and access-controlled.

## 4. Deployment and configuration

- Maintain one Docker Compose stack with `web`, `worker`, and `postgres`.
- `web` and `worker` may share build stages or packages but must run as distinct long-lived processes.
- Include persistent PostgreSQL storage, health checks, restart policies, and graceful shutdown handling.
- Do not expose PostgreSQL to the public internet; if a host port is needed for local development, bind it to `127.0.0.1`.
- Do not expose the dashboard publicly without authentication and TLS.
- Never commit `.env` or credentials. Maintain `.env.example` with placeholder values.
- Run committed Prisma migrations as a deliberate deployment step (`prisma migrate deploy`), not simultaneously from every replica.
- Test LAN/UDP reachability from the actual Docker host before assuming the Marstek integration will function.

## 5. Code quality and security

- Prefer strict TypeScript, small focused modules, and explicit types at package boundaries.
- Favor existing dependencies and patterns; do not add dependencies for trivial utilities.
- Validate request inputs and external responses. Authorize all state-changing HTTP endpoints.
- Ensure database and network operations handle errors and timeouts.
- Log useful context (job, integration, device ID, correlation ID) without sensitive payloads.
- No unsolicited refactors, directory restructures, speculative abstractions, or unrelated formatting changes.
- Keep API contracts backward-compatible unless the task explicitly requires a breaking change.

## 6. Token-efficient workflow

1. Identify the smallest relevant area before reading files. Use targeted filename/search commands; avoid dumping the whole repository.
2. Read `package.json`, configuration, and neighboring code only as necessary. Do not reread unchanged files or restate contents already known in this task.
3. For simple requests, implement directly; make a short plan only for complex or risky changes.
4. Prefer minimal diffs and reuse existing code. Do not create extra docs, tests, abstractions, or packages unrelated to the request.
5. Run focused type checks, linters, and tests for the affected workspace first; broaden verification for cross-cutting changes.
6. Never sacrifice correctness, security, required tests, or important error handling to save tokens.
7. Keep user-facing updates concise. End with a brief summary of changes, checks performed/results, and any unresolved issues. Do not paste large files or command logs unless asked.

## 7. Definition of done

For each completed task, verify as applicable:

- Code is placed in the correct app/package and respects dependency boundaries.
- Types compile and relevant tests/lint checks pass (or any inability to run them is stated).
- API input validation, authorization, error handling, and secrets handling are appropriate.
- Worker jobs have safe scheduling, logging, non-overlap behavior, and retry semantics.
- Database changes have committed migrations and suitable indexes.
- Deployment/configuration changes are reflected in Docker Compose and `.env.example`.
- Final response is short and reports what changed and what was actually verified.
