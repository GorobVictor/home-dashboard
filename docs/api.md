# Local API contracts

All endpoints below require the existing session cookie. Mutations require same-origin
and bounded JSON (4 KiB unless noted). Responses use explicit error JSON: 400 invalid
input, 401 unauthenticated, 403 cross-origin, 404 missing record, 409 conflict, 429
throttled (Retry-After where applicable), 500 internal failure. No secrets are returned.

| Endpoint | Contract |
| --- | --- |
| GET /api/marstek/live?device=ID | Current devices, selected reading and overview only; no historical query; no-store. |
| GET /api/marstek/overview?device=ID&hours=24 | Existing dashboard response, extended with temperature, coverage, analytics and previous-period totals. |
| GET /api/marstek/export?device=ID&range=24 | CSV of minute aggregates; range 1/6/24/168/720 hours, or from/to YYYY-MM-DD, up to 90 UTC days; timestamp column explicitly UTC. |
| GET /api/events/export | CSV of up to 10,000 events, existing source/type/severity/from/to filters; newest first. |
| GET /api/notifications?page=1&unread=true | Existing personal inbox, 20 per page; full UI at /notifications; read status stays personal. |
| POST /api/notification-channels; PUT /api/notification-channels/UUID | Existing fields plus optional eventTypes/deviceIds arrays (32 max), quietFrom/quietTo (both empty or HH:mm), digest boolean. 16 KiB. Empty filter arrays accept all. Kyiv quiet hours defer delivery; critical events bypass quiet hours and digest batching. Digest channels receive yesterday's matching summary after 09:00 Kyiv. |
| PATCH /api/freelancehunt/projects/ID | Existing personal fields plus workflow: none/todo/applied/discussion/done. 16 KiB. Content filters and workflow list filters are independent; workflow does not alter notification recipients. |
| GET /api/sites | Shared household links, ordered by group/position/name. |
| POST /api/sites; PUT /api/sites/UUID | name (1..100), url (HTTPS, no credentials, max 2048), description (0..300), group (1..100), position (integer 0..99999). At most 100 shared links. No server fetches to site URLs. |
| DELETE /api/sites/UUID | Delete one shared link; does not interact with the target service. |
| GET /api/health | Public minimal readiness status only (no operational details); /status requires authentication for job/device/database details. |

Freelancehunt upstream follows its official pagination contract: page[number] and
links.next. The worker follows page numbers it constructs itself, never arbitrary
upstream URLs. Catch-up is bounded to five project pages and three thread pages per
cycle, with durable cursors. Initial multi-cycle baselines are silent. 429 pauses
provider requests according to bounded Retry-After; other stream failures are isolated.
Reference: https://apidocs.freelancehunt.com/
