BEGIN;

-- Retain content filters and presets; replace the removed sort with date order.
UPDATE "freelancehunt_preferences"
SET "filters" = ("filters" - 'minScore' - 'maxScore') ||
    CASE WHEN "filters"->>'sort' = 'relevance' THEN '{"sort":"date"}'::jsonb ELSE '{}'::jsonb END;

UPDATE "freelancehunt_presets"
SET "filters" = ("filters" - 'minScore' - 'maxScore') ||
    CASE WHEN "filters"->>'sort' = 'relevance' THEN '{"sort":"date"}'::jsonb ELSE '{}'::jsonb END;

DROP INDEX "freelancehunt_project_states_userId_score_projectId_idx";
ALTER TABLE "freelancehunt_project_states" DROP COLUMN "score", DROP COLUMN "reasons";
ALTER TABLE "freelancehunt_preferences" DROP COLUMN "scoring", DROP COLUMN "notificationMinScore";
ALTER TABLE "freelancehunt_presets" DROP COLUMN "scoring";
ALTER TABLE "notification_channels" DROP COLUMN "projectScoring", DROP COLUMN "projectMinScore";

COMMIT;
