ALTER TABLE "freelancehunt_projects" ADD COLUMN "skill_ids" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "categories" JSONB NOT NULL DEFAULT '[]';
CREATE INDEX "freelancehunt_projects_published_at_external_id_idx" ON "freelancehunt_projects" ("published_at" DESC, "external_id");
CREATE INDEX "freelancehunt_projects_budget_currency_budget_amount_idx" ON "freelancehunt_projects" ("budget_currency", "budget_amount");
ALTER TABLE "notification_channels" ADD COLUMN "projectMinScore" INTEGER NOT NULL DEFAULT 0 CHECK ("projectMinScore" BETWEEN 0 AND 100), ADD COLUMN "projectScoring" JSONB;
CREATE TABLE "freelancehunt_preferences" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "filters" JSONB NOT NULL, "scoring" JSONB NOT NULL,
  "notificationMinScore" INTEGER NOT NULL DEFAULT 0 CHECK ("notificationMinScore" BETWEEN 0 AND 100),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE "freelancehunt_presets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL, "filters" JSONB NOT NULL, "scoring" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "name")
);
CREATE TABLE "freelancehunt_project_states" (
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" BIGINT NOT NULL REFERENCES "freelancehunt_projects"("id") ON DELETE CASCADE,
  "score" INTEGER NOT NULL CHECK ("score" BETWEEN 0 AND 100), "reasons" JSONB NOT NULL,
  "savedAt" TIMESTAMPTZ(6), "hiddenAt" TIMESTAMPTZ(6), "viewedAt" TIMESTAMPTZ(6),
  "notes" TEXT NOT NULL DEFAULT '', PRIMARY KEY ("userId", "projectId")
);
CREATE INDEX "freelancehunt_project_states_userId_score_projectId_idx" ON "freelancehunt_project_states" ("userId", "score" DESC, "projectId");
CREATE INDEX "freelancehunt_project_states_userId_savedAt_idx" ON "freelancehunt_project_states" ("userId", "savedAt");
CREATE INDEX "freelancehunt_project_states_userId_hiddenAt_idx" ON "freelancehunt_project_states" ("userId", "hiddenAt");
CREATE INDEX "freelancehunt_project_states_userId_viewedAt_idx" ON "freelancehunt_project_states" ("userId", "viewedAt");
