BEGIN;

-- Remove unsupported choices without widening channels that selected only them.
WITH cleaned AS (
  SELECT id,
    COALESCE((SELECT jsonb_agg(item.value ORDER BY item.position)
      FROM jsonb_array_elements(channel."eventTypes") WITH ORDINALITY AS item(value, position)
      WHERE item.value NOT IN ('"marstek.grid_lost"'::jsonb, '"marstek.grid_restored"'::jsonb)), '[]'::jsonb) AS types
  FROM notification_channels AS channel
  WHERE channel."eventTypes" ?| ARRAY['marstek.grid_lost', 'marstek.grid_restored']
)
UPDATE notification_channels AS channel
SET "eventTypes" = cleaned.types,
    enabled = channel.enabled AND jsonb_array_length(cleaned.types) > 0,
    "updatedAt" = CURRENT_TIMESTAMP
FROM cleaned WHERE channel.id = cleaned.id;

-- Preserve immutable event history; retired pending Telegram work cannot be sent.
UPDATE notifications AS notification
SET status = 'cancelled', "leaseUntil" = NULL
FROM events AS event
WHERE notification."eventId" = event.id
  AND notification."channelId" IS NOT NULL
  AND notification.status IN ('pending', 'processing')
  AND event.type IN ('marstek.grid_lost', 'marstek.grid_restored');

UPDATE notification_deliveries AS delivery
SET status = 'cancelled', "finishedAt" = CURRENT_TIMESTAMP, "errorCode" = 'event_type_removed'
FROM notifications AS notification, events AS event
WHERE delivery."notificationId" = notification.id
  AND notification."eventId" = event.id
  AND delivery.status = 'processing'
  AND event.type IN ('marstek.grid_lost', 'marstek.grid_restored');

DELETE FROM event_states WHERE key LIKE 'grid:%';

COMMIT;
