

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" VARCHAR(64) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(500) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "deduplicationKey" VARCHAR(255),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_states" (
    "key" VARCHAR(255) NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_states_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'telegram',
    "chatId" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minSeverity" "EventSeverity" NOT NULL DEFAULT 'info',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL,
    "recipientKey" VARCHAR(100) NOT NULL,
    "userId" UUID,
    "channelId" UUID,
    "readAt" TIMESTAMPTZ(6),
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notificationId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "destination" VARCHAR(100) NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "errorCode" VARCHAR(100),
    "externalMessageId" VARCHAR(100),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_deduplicationKey_key" ON "events"("deduplicationKey");

-- CreateIndex
CREATE INDEX "events_occurredAt_id_idx" ON "events"("occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "events_source_occurredAt_idx" ON "events"("source", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "events_type_occurredAt_idx" ON "events"("type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "events_severity_occurredAt_idx" ON "events"("severity", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_kind_chatId_key" ON "notification_channels"("kind", "chatId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_status_nextAttemptAt_idx" ON "notifications"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_eventId_recipientKey_key" ON "notifications"("eventId", "recipientKey");

-- CreateIndex
CREATE INDEX "notification_deliveries_startedAt_idx" ON "notification_deliveries"("startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notificationId_attempt_key" ON "notification_deliveries"("notificationId", "attempt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "notification_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Events are an append-only audit log, even for accidental repository updates.
CREATE FUNCTION reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events_are_immutable';
END;
$$;
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
