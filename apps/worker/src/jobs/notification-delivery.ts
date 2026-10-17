import { claimNotification, finishNotification } from "@home-dashboard/database";
import { deliverTelegramMessage, TelegramDeliveryError } from "@home-dashboard/integrations";
import { formatNotificationMessage } from "./notification-message";

export interface DeliveryOperations {
  claim: typeof claimNotification;
  finish: typeof finishNotification;
  send: typeof deliverTelegramMessage;
}
const defaults: DeliveryOperations = { claim: claimNotification, finish: finishNotification, send: deliverTelegramMessage };

export async function processNotifications(operations: DeliveryOperations = defaults, token = process.env.TELEGRAM_BOT_TOKEN?.trim()) {
  // Configuration can be repaired without consuming the retry budget.
  if (!token) return;
  for (let index = 0; index < 10; index++) {
    const work = await operations.claim();
    if (!work) return;
    if (work.skipped) continue;
    const { event } = work.notification;
    let result: Parameters<typeof finishNotification>[1];
    try {
      const messageId = await operations.send(token, work.chatId, formatNotificationMessage(event));
      result = { messageId };
    } catch (error) {
      const failure = error instanceof TelegramDeliveryError ? error : new TelegramDeliveryError("telegram_delivery_failed");
      result = { errorCode: failure.code, retryable: failure.retryable, retryAfterSeconds: failure.retryAfterSeconds };
      console.error("notification_delivery_failed", { notificationId: work.notification.id, attempt: work.delivery.attempt, code: failure.code });
    }
    // A database failure here must not be mistaken for an HTTP delivery failure.
    await operations.finish(work.delivery.id, result);
  }
}
