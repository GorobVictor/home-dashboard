# Home Dashboard — Repository Guide for Agents

This file is the source of truth for agents working in this repository. Read the relevant sections before changing code. It describes the implemented system, its boundaries, operational constraints, and safe extension points as of October 2026.

## 1. Product and current capabilities

Home Dashboard is a self-hosted, authenticated dashboard for home energy telemetry and Freelancehunt monitoring. It runs locally through Docker Compose and keeps LAN-device access and external API secrets on the server side.

Implemented features:

- Local-user authentication. Public registration does not exist.
- Marstek Venus E3 monitoring over local UDP: live readings, historical charts, energy totals, device telemetry, and a time-to-empty estimate.
- A background worker that polls every configured Marstek device every second without overlapping polls for that device.
- Freelancehunt monitoring for filtered projects and unread message threads.
- Settings UI that loads the live Freelancehunt skill catalogue and persists only selected numeric skill IDs.
- Browser toast notifications and optional Telegram messages for new Freelancehunt projects/messages.
- Real-time refresh through PostgreSQL `NOTIFY` → authenticated WebSocket → browser, with a browser refresh fallback.
- Centralized immutable events, personal notification inboxes and shared Telegram channels with durable delivery attempts/retries.

Do not introduce the following without an explicit task: DTEK/weather/AI integration, public registration, multi-tenant roles, device-control actions, a queue, leader election, cloud deployment, or a second worker replica.

## 2. Stack and runtime

| Concern | Technology / convention |
| --- | --- |
| Monorepo | npm workspaces, TypeScript, Node.js 22 in containers |
| Web app | Next.js App Router, React, Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| WebSocket server | Custom Node server, `ws`, PostgreSQL `LISTEN` |
| Worker | Node.js, `tsx`, `node-cron`, managed `setTimeout` loops |
| Database | PostgreSQL 17, Prisma 7, committed SQL migrations |
| Device transport | UDP/JSON-RPC to configured IPv4 Marstek hosts |
| External APIs | Freelancehunt v2 REST API and Telegram Bot API |
| Local deployment | Docker Compose |

Prefer existing packages and patterns. Ask before adding a framework, service, queue, deployment provider, state library, or architecture-level dependency.

## 3. Topology and dependency graph

### Package dependency direction

```mermaid
graph TD
  Web[apps/web<br/>Next.js + custom server] --> DB[packages/database<br/>Prisma repositories]
  Web --> INT[packages/integrations<br/>typed clients]
  Worker[apps/worker<br/>scheduler and jobs] --> DB
  Worker --> INT
  DB --> Postgres[(PostgreSQL)]
  INT --> Marstek[Marstek Venus E3<br/>UDP / JSON-RPC]
  INT --> FH[Freelancehunt v2 API]
  INT --> Telegram[Telegram Bot API]
```

Hard boundaries:

- `apps/web` and `apps/worker` may import `@home-dashboard/database` and `@home-dashboard/integrations`.
- Shared packages must not import an app, React, Next.js, route handlers, or worker entrypoints.
- Web must not import worker jobs/schedules; worker must not import web route handlers/UI.
- Browser/client code must never access PostgreSQL, Marstek, or third-party secrets directly.
- Use workspace exports, never source-relative imports across packages.

### Runtime services

```mermaid
graph LR
  Browser[Authenticated browser] -->|HTTP / WebSocket| Web[web service<br/>Next + custom server]
  Web -->|Prisma + pg LISTEN| DB[(postgres)]
  Worker[worker service] -->|Prisma| DB
  Worker -->|UDP unicast| Device[Marstek Venus E3]
  Worker -->|HTTPS| FH[Freelancehunt]
  Worker -->|HTTPS, optional| TG[Telegram]
  DB -->|NOTIFY home_dashboard_events| Web
  Web -->|broadcast event| Browser
```

| Compose service | Role | Exposure / lifecycle |
| --- | --- | --- |
| `postgres` | Persistent database | `postgres_data` volume; also attached to the pre-existing external `shared` network as `home-dashboard_postgres` |
| `migrate` | Applies Prisma migrations | One-shot; setup/web/worker wait for success |
| `web` | Next.js plus custom WebSocket server | `${WEB_PORT}:3000`, published on host interfaces; `WEB_PORT` is required |
| `worker` | Marstek/Freelancehunt jobs | No public port; single replica assumption |
| `setup` | Automatically creates the first user from environment when users table is empty | One-shot after migrations; web/worker wait for success |

The web port is published on host interfaces so other applications on the Docker host can reach it; host firewall rules determine whether other machines can connect. The Compose stack requires an existing external Docker network named `shared`; PostgreSQL joins it under the `home-dashboard_postgres` alias as well as the private Compose network. Keep this network limited to trusted local containers. Never publish PostgreSQL or PgAdmin ports to the host or internet.

## 4. Repository map

```text
apps/
  web/
    src/app/                         # App Router pages, API routes, client UI
      api/auth/                       # login, logout, current-user endpoints
      api/freelancehunt/              # settings and skill catalogue routes
      api/marstek/                    # dashboard overview route
      dashboard/                      # dashboard, charts, project dialog, live updates
      login/                          # login page/form
      settings/                       # Freelancehunt settings page/form
    src/server/                       # server-only auth, input parsing, dashboard service
    src/server.ts                     # custom Next + WebSocket server
    scripts/create-user.ts            # initial-user CLI
  worker/
    src/index.ts                      # process lifecycle and scheduling
    src/jobs/marstek-poll.ts          # testable device polling job
    src/jobs/freelancehunt-poll.ts    # testable Freelancehunt job
packages/
  database/
    prisma/schema.prisma              # Prisma schema
    prisma/migrations/                # committed migration history
    src/client.ts                     # Prisma client/lifecycle
    src/users.ts                      # user repository
    src/marstek.ts                    # persistence, aggregation, events
    src/freelancehunt.ts              # settings, dedupe, persistence, events
  integrations/
    src/marstek.ts                    # UDP client, response validation/mapping
    src/freelancehunt.ts              # API client, validation, Telegram client
docker/
  web.Dockerfile
  worker.Dockerfile
docker-compose.yml
.env.example
AGENTS.md
```

| Change needed | Start with |
| --- | --- |
| Dashboard layout/tabs/mobile UI | `apps/web/src/app/dashboard/page.tsx`, `energy-dashboard.tsx` and adjacent components |
| Smooth number animation | `apps/web/src/app/dashboard/fade-value.tsx` |
| Dashboard data shape/chart sampling | `apps/web/src/server/marstek/dashboard.ts` |
| API security/input validation | route handler plus `apps/web/src/server/auth/*` |
| Settings UI and selected skills | `settings/freelancehunt-settings-form.tsx` |
| Freelancehunt HTTP/Telegram | `packages/integrations/src/freelancehunt.ts` |
| Freelancehunt dedupe/events | `packages/database/src/freelancehunt.ts`, worker job |
| Marstek protocol/mapping | `packages/integrations/src/marstek.ts` |
| Marstek persistence/retention | `packages/database/src/marstek.ts`, dashboard service |
| Poll timing/non-overlap/shutdown | `apps/worker/src/index.ts` |
| Browser real-time behavior | `apps/web/src/server.ts`, `dashboard/live-updates.tsx` |
| Database shape | schema plus new committed migration |

## 5. Authentication and request security

### Authentication model

- Users live in `users`; create them only through `npm run db:create-user` or the Compose `setup` service.
- Automatic setup uses `db:create-user -- --if-empty`; a transaction advisory lock serializes competing first-start runs. It skips populated databases before credential validation, allowing initial credentials to be removed. Manual `db:create-user` supports additional accounts and never changes an existing login's password. Invalid fresh setup must exit nonzero with safe diagnostics.
- Password handling is in `apps/web/src/server/auth/password.ts`; plaintext is never persisted.
- Login stores an HS256 JWT in `home_dashboard_session`.
- Session lifetime is 8 hours (`sessionLifetimeSeconds`).
- Cookie properties: `HttpOnly`, `SameSite=Lax`, `path=/`, conditionally `Secure`.
- JWT validation checks algorithm, issuer, audience, expiration and UUID subject, then checks the user still exists.

### Requirements for routes and state changes

- Protected pages/routes must call `currentUser()`.
- State-changing HTTP routes must also use `sameOrigin()` from `server/auth/http.ts`.
- Bound and parse untrusted JSON. Existing convention: maximum 4096 bytes unless a justified endpoint needs another limit.
- Return explicit error JSON. Never expose password hashes, tokens, database URLs, or untrusted upstream payloads.
- WebSocket upgrade requires a valid session cookie and exact same-origin `Origin`/`Host` match.

## 6. Web application

### Pages

| URL | Behavior |
| --- | --- |
| `/login` | Login form |
| `/dashboard` | Protected dashboard with Energy, Freelancehunt and My sites tabs |
| `/dashboard?tab=sites` | Seven public HTTPS service links, opened in new browser tabs; pgAdmin is hosted in a separate Compose stack |
| `/dashboard?tab=freelancehunt&page=N` | Server-side paginated projects and project dialog |
| `/dashboard?device=ID&range=H` | Selected Marstek device and predefined range |
| `/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | Custom UTC range; max 90 days and never future |
| `/settings` | Protected Freelancehunt monitoring settings |
| `/events` | Protected filtered, paginated immutable event log |
| `/settings/notifications` | Shared Telegram channels, tests and delivery history |

Default to Server Components. Existing focused client components:

- `live-updates.tsx`: WebSocket, toast notifications, 250 ms refresh debounce, reconnect backoff 1–30 seconds.
- `freelancehunt-projects.tsx`: responsive project listing and accessible details dialog.
- `range-controls.tsx`: predefined/custom ranges.
- `marstek-charts.tsx`: Recharts charts.
- `fade-value.tsx`: vertical 200 ms numeric rollover; it cleans up timers/animation frames and avoids a full fade blink.

Use shadcn components in `apps/web/src/components/ui`, semantic controls, focus states, empty/error/loading states, Tailwind theme tokens, and responsive layouts. Narrow screens must retain usable tab navigation, forms, tables, and dialogs.

Login, dashboard and settings share the dark graphite palette through `dashboard-theme` on the root layout. Shared colors live in `globals.css`; `dashboard-shell` adds the subtle background accent, including on login/settings. Keep portalled dialogs and toast notifications consistent with this theme.

### Dashboard composition

`getMarstekDashboard()` is the server-side composition point. It:

1. Reads configured devices and newest measurement per device.
2. Defines online as enabled with a measurement younger than 3 minutes.
3. Chooses requested device, otherwise first enabled, otherwise first available.
4. Loads selected-device historical buckets for requested/custom range.
5. Samples chart points to approximately 400, preserving outage boundaries and null gap markers.
6. Returns fleet overview, latest selected telemetry, points, energy totals, and range bounds.

Predefined `DashboardRange`: `1`, `6`, `24`, `168`, `720` hours (1 h, 6 h, 24 h, 7 d, 30 d). Keep `/api/marstek/overview` validation aligned if ranges change.

Historical buckets are 60 seconds for ≤24 h and 600 seconds above that. Do not pass raw one-second rows to multi-day charts.

History queries must apply both range bounds. Charts use a numeric time axis spanning the requested range; missing history must not be stretched or connected across outages. Energy buckets without measurements remain null, distinct from measured zero. `server/marstek/history.ts` owns sampling, gap markers and energy summaries.

### Time to empty

```text
minutes_to_empty = remaining_capacity_Wh / current_discharge_W × 60
```

- `remainingCapacityWh` is the latest device reading; `dischargePowerW` is the non-negative output magnitude.
- Estimate renders only above 0.5 W discharge and is bounded to 365 days; otherwise `—`.
- It assumes unchanged load/current usable capacity and is not a BMS prediction.
- The top battery-overview card is the primary placement; do not create conflicting duplicate calculations. It keeps the duration in a single fixed-height row with separate day/hour/minute units.

## 7. Real-time event pipeline

```mermaid
sequenceDiagram
  participant W as Worker
  participant R as Database repository
  participant PG as PostgreSQL
  participant S as Custom web server
  participant B as Browser
  W->>R: save reading/project/thread
  R->>PG: transaction + pg_notify(home_dashboard_events, JSON)
  PG-->>S: LISTEN notification
  S-->>B: authenticated WebSocket broadcast
  B->>B: toast where applicable; debounced router.refresh()
```

Channel name is exactly `home_dashboard_events`. Payloads must remain compact JSON and backward-compatible.

| Event | Producer | Browser action |
| --- | --- | --- |
| `marstek.measurement.saved` | `saveMarstekReading` | Debounced refresh |
| `freelancehunt.project.discovered` | `saveFreelancehuntProjects` | Toast/Open action, refresh |
| `freelancehunt.message.discovered` | `saveFreelancehuntThreads` | Toast/Open action, refresh |
| `connection.ready` | custom server | Connection acknowledgement only |
| `notifications.changed` | event/notification repositories | Inbox reload and debounced page refresh |

`apps/web/src/server.ts` runs Next and `ws` together. It owns PostgreSQL `LISTEN`, reconnection after failure, 30-second socket pings and graceful shutdown. Do not replace this with a Next route handler: WebSocket upgrades depend on this custom-server arrangement.

For a new event:

1. Persist/deduplicate state first.
2. `pg_notify` inside the same transaction.
3. Do not include secrets or oversized data.
4. Narrow payloads defensively in client code.
5. Keep server-rendered HTTP data as source of truth; the socket is invalidation/notification only.

## 8. Marstek integration

### Configuration and connectivity

`MARSTEK_DEVICES` is a JSON array:

```json
[{"id":"venus-e3-1","name":"Venus E3","host":"192.168.3.224","port":30000}]
```

`parseMarstekDevices()` permits up to 32 unique entries and validates:

- ID: lowercase alphanumeric plus `_`/`-`, 1–64 chars.
- Name: non-empty, max 100 chars.
- Host: IPv4 only.
- Port: integer `1..65535`.

The system sends direct UDP unicast. Docker Desktop broadcast discovery is not reliable; test reachability from the actual Docker host.

### Polling flow

```mermaid
flowchart TD
  Start[Worker starts] --> Sync[syncMarstekDevices]
  Sync --> Loop[Per-device managed loop]
  Loop --> Main[ES.GetStatus every ~1s]
  Main --> Details{Details older than 60s?}
  Details -->|Yes| Optional[Bat.GetStatus then ES.GetMode]
  Details -->|No| Map[Validate/map reading]
  Optional --> Map
  Map --> Save[saveMarstekReading transaction]
  Save --> Notify[pg_notify]
  Notify --> Loop
```

- Scheduling belongs in `apps/worker/src/index.ts`; reusable transport is integrations and persistence is database.
- Each device schedules next work only in the previous run's `finally`, preventing overlap.
- `pollMarstekDevices()` processes devices in groups of four.
- Main status client: 800 ms timeout, one attempt. Details use a longer retrying client, cached for 60 seconds to preserve one-second status cadence.
- Device read failures record `lastError`; identical failures log no more than once per minute. Persistence failures are logged separately and must never mark a responding device unavailable. Timeouts must not stop worker.
- Startup upserts/enables configured devices and disables removed ones.
- Retention runs at 03:17 UTC, deleting readings older than 90 days.

### Units and semantics

| Field group | Contract |
| --- | --- |
| `socPercent` | `0..100` |
| `batteryPowerW` | Positive charging, negative discharging |
| `chargePowerW` / `dischargePowerW` | Non-negative directional values |
| `powerSource` | `reported`, `derived`, `unavailable`; label derived values honestly |
| Grid/PV/off-grid/meter values | Instantaneous watts, nullable |
| Capacity and cumulative totals | Watt-hours, nullable |
| Temperature | Celsius, nullable |
| `flow` | ±20 W threshold: charging/discharging/idle |
| Mode/flags | Nullable when optional RPC does not provide them |

Directional energy uses trapezoidal integration:

```text
energy_Wh = (previous_power_W + current_power_W) / 2 × elapsed_hours
```

Integration is skipped after gaps above 5 minutes, so outages never create invented energy.

### Add a Marstek metric

1. Identify firmware field and unit.
2. Validate/map it in `packages/integrations/src/marstek.ts` and `MarstekReading`.
3. Add migration + repository selections when persistence is needed.
4. Add dashboard response/UI with null handling.
5. Add parser tests for valid, missing, and invalid values.

Never add device-control methods without explicit scope, strong validation, authorization, and safety UX.

## 9. Freelancehunt and Telegram

### Client behavior

`FreelancehuntClient` in `packages/integrations/src/freelancehunt.ts` is the sole v2 client.

- Base URL: `https://api.freelancehunt.com/v2`.
- Auth: `Authorization: Bearer <FREELANCEHUNT_API_TOKEN>`.
- `Accept-Language: uk`; request timeout 10 seconds via `AbortController`.
- `429` normalizes to `freelancehunt_rate_limited`.
- All upstream responses are structurally narrowed before becoming domain objects.

Projects call `filter[skill_id]` with comma-separated selected IDs. Persist IDs, not names. Settings fetch live readable names and groups from `/v2/skills`.

### Settings model

Singleton row is `freelancehunt_settings.id = "default"`.

| Field | Meaning |
| --- | --- |
| `enabled` | Master switch; worker returns early when false or API token absent |
| `projectPollingEnabled` | Poll project list |
| `messagePollingEnabled` | Poll threads/unread messages |
| `telegramEnabled` | Permit newly generated Freelancehunt notifications to target enabled Telegram channels |
| `pollIntervalSeconds` | Valid `10..3600`; worker minimum next delay is 5 s |
| `skillIds` | ≤50 distinct positive numeric IDs |
| `projectsInitialized`, `messagesInitialized` | Baseline: first successful batch persists but never notifies |

Default IDs preserve original filters: `103, 120, 121, 169, 175, 180, 183, 190, 24, 86`.

Do not make Freelancehunt one-second polling without a rate-limit design. A cycle can call both projects and threads; Marstek's one-second cadence is separate and intentional.

### Poll/dedupe/notification flow

```mermaid
flowchart LR
  Timer[Managed timer] --> Settings[Load settings]
  Settings --> Enabled{Enabled + token?}
  Enabled -->|No| Next[Schedule next interval]
  Enabled -->|Yes| Projects[Fetch matching projects]
  Enabled -->|Yes| Threads[Fetch threads]
  Projects --> SaveProjects[Persist unseen projects]
  Threads --> SaveThreads[Upsert / detect new unread activity]
  SaveProjects --> Events[pg_notify]
  SaveThreads --> Events
  SaveProjects --> Pending[Persist pending notifications]
  SaveThreads --> Pending
  Pending --> Delivery[Worker delivery loop]
  Delivery --> Telegram{Telegram enabled/configured?}
  Events --> Next
  Telegram --> Next
```

Projects deduplicate by `external_id`. The baseline batch creates database rows but emits no event. Later unseen projects persist, notify browser, and optionally produce Telegram messages.

Threads upsert by `external_id`. After baseline, notification requires unread status plus a changed message count or last-post time.

Telegram delivery uses native `fetch` in `packages/integrations/src/telegram.ts`, a 10-second timeout and safe error codes. Delivery failures are recorded independently of polling and retried by `apps/worker/src/jobs/notification-delivery.ts`; no external request runs inside a transaction. The legacy `sendTelegramMessage` export delegates to this client.

### Endpoints

| Endpoint | Method | Security / purpose |
| --- | --- | --- |
| `/api/freelancehunt/settings` | `GET` | Authenticated singleton settings |
| `/api/freelancehunt/settings` | `PUT` | Authenticated, same-origin, ≤4 KiB, validated update |
| `/api/freelancehunt/skills` | `GET` | Authenticated fresh skill list, no-store cache |
| `/api/marstek/overview` | `GET` | Authenticated bounded device/range JSON overview |
| `/api/auth/login` | `POST` | Bounded credentials input; sets cookie |
| `/api/auth/logout` | `POST` | Session logout |
| `/api/auth/me` | `GET` | Current authenticated user |
| `/api/events` | WebSocket upgrade | Existing authenticated socket; keep HTTP routes off this exact path |
| `/api/events/list` | GET | Filtered, paginated central event log |
| `/api/notifications` | GET | Personal paginated inbox, optional unread filter |
| `/api/notifications/read` | POST | Mark owned notification or personal inbox read |
| `/api/notification-channels` | GET / POST | Shared household channel listing/creation |
| `/api/notification-channels/[id]` | PUT / DELETE | Update / disable channel, cancel pending work |
| `/api/notification-channels/[id]/test` | POST | Persist a test event for enabled destination; 30 s per-user cooldown |
| `/api/notification-deliveries` | GET | Paginated delivery history, optional channel filter |

`{ "error": "freelancehunt_not_configured" }` means the web container lacks `FREELANCEHUNT_API_TOKEN`. Set it in private `.env`, then rebuild/restart relevant Compose services; never hard-code it.

## 10. Database

### Prisma conventions

- Schema: `packages/database/prisma/schema.prisma`.
- Generated client: `packages/database/generated/client`; never hand edit it.
- Shared client/lifecycle: `packages/database/src/client.ts`; worker shutdown calls `disconnectDatabase()`.
- Migrations: `packages/database/prisma/migrations/<timestamp>_<description>/migration.sql`.
- Compose runs `prisma migrate deploy` in dedicated `migrate` service.
- Never use `prisma db push` as production migration workflow.

### Models

| Model | Key/indexes | Purpose |
| --- | --- | --- |
| `User` | UUID ID, unique login | Local identity |
| `MarstekDevice` | Config ID | Metadata, enabled state, last seen/error |
| `MarstekMeasurement` | BigInt; `(deviceId, sampledAt DESC)`, `sampledAt` | Time-series readings + interval energy |
| `FreelancehuntSettings` | singleton `default` | Monitoring switches/filters/baselines |
| `FreelancehuntProject` | unique external ID, `discoveredAt DESC` | Project feed |
| `FreelancehuntThread` | unique external ID, `(isUnread,lastPostedAt DESC)` | Thread change state |

All historical timestamps are `timestamptz` / UTC `Date`. New time-series access must include suitable device/time indexing. Put persistence, dedupe, transactions and `pg_notify` in `packages/database`; do not duplicate Prisma/SQL in apps.

## 11. Environment configuration

Never commit `.env`, tokens, passwords, credentials, or private local values. Keep `.env.example` complete.

| Variable | Used by | Notes |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Compose | Required; Compose builds internal database URL |
| `AUTH_JWT_SECRET` | web | Required, at least 32 UTF-8 bytes |
| `INITIAL_USER_FIRST_NAME`, `INITIAL_USER_LAST_NAME`, `INITIAL_USER_LOGIN`, `INITIAL_USER_PASSWORD` | setup | Initial user; password must be 12+ chars |
| `WEB_PORT` | Compose | Required host port for the web service; `.env.example` sets it to 3000 |
| `MARSTEK_DEVICES` | worker | JSON device list |
| `FREELANCEHUNT_API_TOKEN` | web + worker | Enables skills endpoint and monitoring |
| `TELEGRAM_BOT_TOKEN` | worker | Secret; required for Telegram delivery, never persisted |
| `TELEGRAM_CHAT_ID` | worker | Optional one-time import as a Freelancehunt channel; UI then authoritative |
| `MARSTEK_LOW_BATTERY_PERCENT` | worker | 1..90, default 20; recovery threshold +5 |
| `DATABASE_URL` | application processes | Compose injects it; direct local commands need it |
| `HOSTNAME`, `PORT` | custom web server | Defaults `0.0.0.0:3000`; Compose sets hostname |

Web receives Freelancehunt token because settings load skills. Worker receives Freelancehunt/Telegram credentials because it polls/notifies. Secrets must never appear in browser code or database rows.

## 12. Local development and operations

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next web dev server |
| `npm run dev:worker` | Worker via `tsx` |
| `npm run typecheck` | Generate Prisma client and type-check workspaces |
| `npm run lint` | Web ESLint |
| `npm test` | Auth, integrations and worker-job tests |
| `npm run build` | Workspace builds |
| `npm run db:generate` | Prisma client generation |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:create-user` | Create local user from environment |
| `docker compose up -d --build` | Full stack build/start |
| `docker compose up -d --build web` | Rebuild web after web/UI code change |
| `docker compose ps` | Inspect service health |
| `docker compose logs -f worker` | Inspect poll/notification logs |

URL: `http://127.0.0.1:${WEB_PORT}` dashboard (default 3000 from `.env.example`). The port is published on host interfaces. Create the required external network once with `docker network create shared` if it does not already exist.

### Safe local setup

1. Copy `.env.example` to private `.env`; set passwords/secrets.
2. `docker compose up -d --build`.
3. Compose automatically creates the first user from `INITIAL_USER_*` after migrations, before web/worker start. Existing users skip setup without changing credentials. Use the same `--env-file` for every command when configuration is stored outside the checkout. For an additional user, run `docker compose run --rm setup npm run db:create-user`; direct local commands require `DATABASE_URL`.
4. Log in, then configure Freelancehunt settings only after token is injected into both web and worker.
5. Confirm Marstek LAN/UDP reachability from Docker host.

### Diagnostics

| Symptom | First checks |
| --- | --- |
| Battery missing/data stale | `MARSTEK_DEVICES`, worker logs, physical LAN UDP path, `lastError` |
| `marstek_poll_failed` | Timeout is tolerated; verify IP/port/firmware/LAN, not broadcast discovery |
| No live dashboard refresh | Confirm custom `server.ts`, PostgreSQL listener, same-origin authenticated socket |
| Skills endpoint fails | Check web token; 503 `freelancehunt_not_configured` is expected when absent |
| No Freelancehunt alerts | Master/sub switches, baseline, token, interval, selected IDs, worker logs, API limits |
| No Telegram alert | Settings switch, worker token/chat ID, bot channel permission |
| New project not shown | Filter match, baseline, persistence, or pagination |

## 13. Testing and verification

Existing tests cover auth (`apps/web/src/server/auth/*.test.ts`), Marstek/Freelancehunt integration parsing, and Marstek polling job behavior. Tests must not require a real battery, external credentials, Telegram, or production database.

Before handoff:

1. Run focused relevant tests first.
2. Run `npm run typecheck` after TypeScript/schema/package-boundary changes.
3. Run `npm run lint` after web/TSX changes.
4. Run `npm test` for integrations, auth, scheduling, parsing, or broad changes.
5. Rebuild affected Docker services and check `docker compose ps` for runtime/deployment changes.
6. For live-event work, verify full path: authenticated WebSocket, database `NOTIFY`, client receipt/refresh.

## 14. Implementation standards

### General

- Prefer strict TypeScript, small modules, explicit package-boundary types.
- Validate external API/device data and all HTTP input at boundaries.
- Model unavailable device data as `null`; UI must handle it honestly.
- Structured logs need context but never secrets/unbounded upstream payloads.
- Preserve API/event compatibility unless breaking change is explicitly requested.
- No unsolicited refactor, dependency addition, restructure, formatting sweep, commit, push, PR, external message, or secret mutation.

### Web

- App Router APIs belong in `apps/web/src/app/api/**/route.ts`.
- Keep routes thin: auth, input validation, service/repository call, explicit response.
- Use Server Components by default; client components only for interactivity/browser APIs.
- Keep pagination server-side/bounded and charts aggregated/sampled.

### Worker

- Keep scheduling/process lifecycle in worker; reusable logic in shared packages.
- Catch/report errors per job so one integration failure never kills worker.
- Preserve non-overlap. Do not replace managed loops with unsafe intervals.
- Never run multiple replicas without database-backed leader/locking.
- Do not call web HTTP just to execute local work.

### Database and integrations

- Schema changes require migration, repository mapping, types and indexes in same cohesive change.
- Store units/retention consistently with dashboard aggregation.
- `pg_notify` only after persistent state in same transaction.
- Configure hosts/tokens/timeouts through environment, with bounded retries only when safe.
- Marstek calls remain direct unicast and sequential per device.

## 15. Change playbooks

### External integration

1. Confirm credentials, rate, read/control scope.
2. Build validated client in `packages/integrations`.
3. Add repositories/migrations only if persistence is needed.
4. Add safe worker job if polling is needed.
5. Add protected web/API/UI layer.
6. Add compact event through existing PostgreSQL/WebSocket path only if live UX needs it.
7. Update `.env.example`, Compose wiring, tests, and this guide when architecture materially changes.

### Freelancehunt filter/settings change

1. Continue persisting numeric IDs, not display names.
2. Continue fetching names/groups dynamically for readable settings UI.
3. Update settings type/validation, schema/migration if needed, route, UI and worker together.
4. Reassess upstream rate limit before adding calls or lowering interval.

### Live-notification change

1. Persist and dedupe before notifying.
2. Notify only meaningful post-baseline changes.
3. Keep events minimal; client narrows them.
4. Treat Telegram configuration as a separate optional delivery path.

## 16. Agent workflow and definition of done

1. Start with `git status --short`; preserve existing user changes. A dirty tree is normal.
2. Use `rg`/`rg --files` to identify smallest relevant area; avoid dumping unrelated code.
3. Read neighboring contracts before changing public types, events, schema, or environment variables.
4. Make the smallest cohesive change in correct package boundary.
5. Use `apply_patch` for edits. Never reset/clean/overwrite unrelated work.
6. Verify proportional to risk using Section 13.
7. Do not commit/push/create PR/send messages unless user explicitly requests it.
8. End with concise Ukrainian summary: changed items, checks actually run, remaining limitation.

Done means applicable code is in right boundary, types/tests pass or gap is stated, inputs/secrets are safe, migration/config wiring exists when required, worker stays safe, and local service is rebuilt when user expects to see the result.

## 17. Central events and notifications

- `packages/database/src/events.ts` owns publication, durable observations, per-user inbox fanout, channel filtering and compact invalidation within the producer transaction. `event-policy.ts` contains severity, hysteresis and retry policies. Exported `publishEvent` and `observeEvent` can be used by either app. Permanent deduplication keys and time-window deduplication use transaction advisory locks; they do not elect a worker leader.
- `Event` is immutable, enforced by a database trigger. `EventState` persists baseline/transition/deduplication state. `Notification` is unique per event/recipient. Browser inboxes use `userId`; Telegram deliveries use `channelId`. Never share read status between users.
- All authenticated local users manage shared household channels and delivery history; no roles were added. API mutations require same-origin requests and bounded validated input. Channel data contains destinations and filters, never bot credentials.
- Delivery is processed every two seconds by the existing single worker. Claim/update and individual attempts are persisted, with a 120 s lease and six-attempt budget. An expired attempt becomes `unknown`; retries honor Telegram backoff. Missing bot configuration does not consume attempts. Do not claim exactly-once external delivery; ambiguous responses can duplicate messages.
- `apps/worker/src/jobs/notification-message.ts` renders saved events as bounded Telegram HTML with escaped dynamic fields, event-specific Ukrainian headings/details, safe HTTPS Freelancehunt links and explicitly labelled `Europe/Kyiv` timestamps. Keep formatting out of immutable event records and browser inbox titles. The integrations client accepts plain strings for legacy callers or explicit HTML messages; never truncate assembled HTML or expose arbitrary payload fields.
- Changing a channel cancels pending work instead of redirecting old notifications. In-flight HTTP may finish. DELETE archives/disables the channel so history survives. Tests bypass severity/source filters, but not channel enablement.
- Automatic Marstek events cover low/recovered/full battery and device offline/online. Availability transitions require three minutes of observed read failures or 30 seconds of successful reads for recovery. `EventState.candidateValue`, `candidateSinceAt` and `lastObservedAt` persist confirmation; gaps over 30 seconds or backwards clock changes restart it so host/worker pauses are not mistaken for device outages. Initial observations are silent, including a stale device until failed polls confirm the outage. Live dashboard freshness remains based on measurement age. Current RPCs lack a trustworthy grid-presence signal: `observeMarstekGrid` supports confirmed transitions but is deliberately not fed grid-power or CT connectivity guesses.
- Freelancehunt discoveries publish central events in the existing persistence transactions while keeping legacy WebSocket events. Three failed polling cycles produce `system.service_unavailable`; recovery produces `system.service_restored`. Telegram delivery failures stay in delivery history to avoid recursive alerts.
- `events.integration.test.ts` requires an explicit disposable `EVENTS_TEST_DATABASE_URL` ending in `_events_test` and fresh migrations. Default tests require no database or external credentials.
- `marstek.integration.test.ts` requires a fresh disposable `MARSTEK_TEST_DATABASE_URL` ending in `_marstek_test`. It checks stable availability transitions, reconnect-safe confirmation and notification fanout without contacting a device or Telegram.

## 18. Freelancehunt personal workspace

- `packages/integrations/src/freelancehunt-rules.ts` is a pure browser-safe domain module exported as `@home-dashboard/integrations/freelancehunt-rules`. It owns filter validation, input contracts and personal state patches. Projects are selected by filters only; no scoring or ranking rules are used.
- `packages/database/src/freelancehunt-workspace.ts` owns per-user filters, up to 30 named filter presets and sparse project states. Filters, date/budget sorts and pagination run in PostgreSQL. Saved/viewed/hidden timestamps and notes are personal. Projects without a personal state row remain visible and New. Default lists exclude hidden projects; New means not viewed by that user.
- The existing single worker still polls with the configured skill IDs/cadence. It loads the skill catalogue at most daily (retry after five minutes on failure), maps numeric skills to category group names, and backfills old project metadata without rediscovery notifications. No per-project detail requests are added to polling.
- Project synchronization uses a transaction advisory lock to serialize baseline/unique-ID checks, including duplicate IDs within a batch. Initial results are silent. Later projects always generate immutable `freelancehunt.project_created` events. Personal inbox/toast recipients match saved content filters; saved/viewed/hidden list state does not suppress future discoveries. Telegram channels follow collection settings, source/severity filters and the Telegram master switch. Filter changes do not replay old notifications. `EventInput.userIds`/`channelIds` only scope fanout and are never persisted in event payloads.
- Authenticated `GET/PUT /api/freelancehunt/workspace`, `POST /api/freelancehunt/presets`, `DELETE /api/freelancehunt/presets/[id]` and `PATCH /api/freelancehunt/projects/[id]` manage personal data; mutations require same-origin. Filters use a bounded 16 KiB JSON body for keyword/category selections. Notes allow up to 3,000 characters.
- Authenticated `GET /api/freelancehunt/projects/[id]` requires an already synchronized external project ID, calls `FreelancehuntClient.getProject`, and returns no-store live details. It never writes live details into the database. The dialog renders stored data immediately and fetches current data separately with cancellation/retry/fallback. Descriptions stay plain text; outgoing project URLs are validated as HTTPS Freelancehunt links.
- `freelancehunt.integration.test.ts` requires a fresh disposable `FREELANCEHUNT_TEST_DATABASE_URL` ending in `_freelancehunt_test`, with committed migrations applied. It checks actual SQL filters, personal state persistence/isolation, presets, projects without personal state rows, baseline/concurrent deduplication and filter-based notification recipients. Default tests remain offline.

Container monitoring and control are managed separately in Portainer. Do not add Docker socket access or container-management features to the dashboard without an explicit task.
