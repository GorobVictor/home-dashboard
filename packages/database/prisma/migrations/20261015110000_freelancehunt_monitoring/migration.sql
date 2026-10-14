CREATE TABLE "freelancehunt_settings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "project_polling_enabled" BOOLEAN NOT NULL DEFAULT true,
  "message_polling_enabled" BOOLEAN NOT NULL DEFAULT true,
  "telegram_enabled" BOOLEAN NOT NULL DEFAULT true,
  "poll_interval_seconds" INTEGER NOT NULL DEFAULT 60,
  "skill_ids" JSONB NOT NULL DEFAULT '[]',
  "projects_initialized" BOOLEAN NOT NULL DEFAULT false,
  "messages_initialized" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "freelancehunt_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freelancehunt_projects" (
  "id" BIGSERIAL NOT NULL,
  "external_id" INTEGER NOT NULL,
  "name" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "url" VARCHAR(2048) NOT NULL,
  "budget_amount" DOUBLE PRECISION,
  "budget_currency" VARCHAR(8),
  "skills" JSONB NOT NULL DEFAULT '[]',
  "published_at" TIMESTAMPTZ(6),
  "discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "freelancehunt_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "freelancehunt_threads" (
  "id" BIGSERIAL NOT NULL,
  "external_id" INTEGER NOT NULL,
  "subject" VARCHAR(500) NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "last_posted_at" TIMESTAMPTZ(6),
  "messages_count" INTEGER NOT NULL DEFAULT 0,
  "is_unread" BOOLEAN NOT NULL DEFAULT false,
  "discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "freelancehunt_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "freelancehunt_projects_external_id_key" ON "freelancehunt_projects"("external_id");
CREATE INDEX "freelancehunt_projects_discovered_at_idx" ON "freelancehunt_projects"("discovered_at" DESC);
CREATE UNIQUE INDEX "freelancehunt_threads_external_id_key" ON "freelancehunt_threads"("external_id");
CREATE INDEX "freelancehunt_threads_is_unread_last_posted_at_idx" ON "freelancehunt_threads"("is_unread", "last_posted_at" DESC);
