export class TelegramDeliveryError extends Error {
  constructor(public readonly code: string, public readonly retryable = true, public readonly retryAfterSeconds = 0) {
    super(code);
  }
}

export async function deliverTelegramMessage(token: string, chatId: string, text: string, request: typeof fetch = fetch): Promise<string> {
  if (!token) throw new TelegramDeliveryError("telegram_not_configured", false);
  try {
    const response = await request(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096), link_preview_options: { is_disabled: true } }), signal: AbortSignal.timeout(10_000),
    });
    const body: unknown = await response.json().catch(() => null);
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const parameters = data.parameters && typeof data.parameters === "object" ? data.parameters as Record<string, unknown> : {};
    const code = typeof data.error_code === "number" && Number.isInteger(data.error_code) && data.error_code >= 400 && data.error_code <= 599 ? data.error_code : response.status;
    if (!response.ok || data.ok !== true) throw new TelegramDeliveryError(`telegram_http_${code}`, code === 429 || code >= 500, typeof parameters.retry_after === "number" && Number.isFinite(parameters.retry_after) ? parameters.retry_after : 0);
    const result = data.result && typeof data.result === "object" ? data.result as Record<string, unknown> : {};
    if (typeof result.message_id !== "number" || !Number.isSafeInteger(result.message_id)) throw new TelegramDeliveryError("telegram_invalid_response");
    return String(result.message_id);
  } catch (error) {
    if (error instanceof TelegramDeliveryError) throw error;
    // fetch errors can contain the request URL, which embeds the bot token.
    throw new TelegramDeliveryError(error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "telegram_timeout" : "telegram_network_error");
  }
}
