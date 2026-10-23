ALTER TABLE "event_states"
  ADD COLUMN "candidateValue" VARCHAR(100),
  ADD COLUMN "candidateSinceAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastObservedAt" TIMESTAMPTZ(6);
