CREATE TABLE "docker_engines" (
  "id" varchar(32) PRIMARY KEY DEFAULT 'default', "name" varchar(255), "last_seen_at" timestamptz(6), "last_error" varchar(100), "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "docker_containers" (
  "id" varchar(128) PRIMARY KEY, "engine_id" varchar(32) NOT NULL DEFAULT 'default', "name" varchar(255) NOT NULL, "image" varchar(1024) NOT NULL, "state" varchar(32) NOT NULL, "health" varchar(32) NOT NULL DEFAULT 'none', "compose_project" varchar(255), "compose_service" varchar(255), "created_at_docker" timestamptz(6), "started_at" timestamptz(6), "finished_at" timestamptz(6), "exit_code" integer, "restart_count" integer NOT NULL DEFAULT 0, "last_seen_at" timestamptz(6), "missing_since" timestamptz(6), "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "docker_containers_engine_id_fkey" FOREIGN KEY ("engine_id") REFERENCES "docker_engines"("id") ON DELETE CASCADE
);
CREATE INDEX "docker_containers_engine_id_last_seen_at_idx" ON "docker_containers"("engine_id", "last_seen_at" DESC);
CREATE INDEX "docker_containers_name_idx" ON "docker_containers"("name");
CREATE TABLE "docker_metrics" (
  "id" bigserial PRIMARY KEY, "container_id" varchar(128) NOT NULL, "sampled_at" timestamptz(6) NOT NULL, "cpu_percent" double precision, "memory_usage_bytes" bigint, "memory_working_set_bytes" bigint, "memory_limit_bytes" bigint, "memory_percent" double precision, "network_rx_bytes" bigint, "network_tx_bytes" bigint, "network_rx_per_second" double precision, "network_tx_per_second" double precision, "block_read_bytes" bigint, "block_write_bytes" bigint, "pids" integer,
  CONSTRAINT "docker_metrics_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "docker_containers"("id") ON DELETE CASCADE
);
CREATE INDEX "docker_metrics_container_id_sampled_at_idx" ON "docker_metrics"("container_id", "sampled_at" DESC);
CREATE INDEX "docker_metrics_sampled_at_idx" ON "docker_metrics"("sampled_at");
CREATE TABLE "docker_metric_rollups" (
  "id" bigserial PRIMARY KEY, "container_id" varchar(128) NOT NULL, "bucket_at" timestamptz(6) NOT NULL, "cpu_percent" double precision, "memory_working_set_bytes" bigint, "network_rx_per_second" double precision, "network_tx_per_second" double precision,
  CONSTRAINT "docker_metric_rollups_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "docker_containers"("id") ON DELETE CASCADE,
  CONSTRAINT "docker_metric_rollups_container_id_bucket_at_key" UNIQUE ("container_id", "bucket_at")
);
CREATE INDEX "docker_metric_rollups_bucket_at_idx" ON "docker_metric_rollups"("bucket_at");
CREATE TABLE "docker_monitoring_settings" ("id" varchar(32) PRIMARY KEY DEFAULT 'default', "enabled" boolean NOT NULL DEFAULT true, "poll_interval_seconds" integer NOT NULL DEFAULT 10, "stopped_alerts_enabled" boolean NOT NULL DEFAULT true, "unhealthy_alerts_enabled" boolean NOT NULL DEFAULT true, "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "docker_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "request_id" varchar(64) NOT NULL, "user_id" uuid NOT NULL, "container_id" varchar(128) NOT NULL, "action" varchar(16) NOT NULL, "status" varchar(16) NOT NULL, "error_code" varchar(100), "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finished_at" timestamptz(6),
  CONSTRAINT "docker_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "docker_actions_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "docker_containers"("id") ON DELETE CASCADE,
  CONSTRAINT "docker_actions_user_id_request_id_key" UNIQUE ("user_id", "request_id")
);
CREATE INDEX "docker_actions_container_id_status_idx" ON "docker_actions"("container_id", "status");
CREATE INDEX "docker_actions_created_at_idx" ON "docker_actions"("created_at" DESC);
