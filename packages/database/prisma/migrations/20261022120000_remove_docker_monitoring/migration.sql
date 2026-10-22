BEGIN;

-- Retain immutable events and delivery history, but stop obsolete alerts.
UPDATE "notification_deliveries"
SET "status" = 'unknown', "finishedAt" = CURRENT_TIMESTAMP, "errorCode" = 'integration_removed'
WHERE "status" = 'processing' AND "notificationId" IN (
  SELECT n."id" FROM "notifications" n JOIN "events" e ON e."id" = n."eventId"
  WHERE e."source" = 'docker'
     OR (e."source" = 'system' AND e."payload"->>'service' = 'docker_engine')
);

UPDATE "notifications" n
SET "status" = 'cancelled', "leaseUntil" = NULL
FROM "events" e
WHERE n."eventId" = e."id" AND n."status" IN ('pending', 'processing')
  AND (e."source" = 'docker'
       OR (e."source" = 'system' AND e."payload"->>'service' = 'docker_engine'));

-- An empty source list means all sources: disable Docker-only channels.
UPDATE "notification_channels"
SET "sources" = "sources" - 'docker',
    "enabled" = CASE WHEN "sources" - 'docker' = '[]'::jsonb THEN false ELSE "enabled" END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "sources" @> '["docker"]'::jsonb;

DELETE FROM "event_states" WHERE "key" LIKE 'docker-%' OR "key" = 'service:docker_engine';

-- DropForeignKey
ALTER TABLE "docker_containers" DROP CONSTRAINT "docker_containers_engine_id_fkey";
ALTER TABLE "docker_metrics" DROP CONSTRAINT "docker_metrics_container_id_fkey";
ALTER TABLE "docker_metric_rollups" DROP CONSTRAINT "docker_metric_rollups_container_id_fkey";
ALTER TABLE "docker_actions" DROP CONSTRAINT "docker_actions_user_id_fkey";
ALTER TABLE "docker_actions" DROP CONSTRAINT "docker_actions_container_id_fkey";

-- DropTable
DROP TABLE "docker_engines";
DROP TABLE "docker_containers";
DROP TABLE "docker_metrics";
DROP TABLE "docker_metric_rollups";
DROP TABLE "docker_monitoring_settings";
DROP TABLE "docker_actions";

COMMIT;
