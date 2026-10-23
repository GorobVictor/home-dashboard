import type { TelegramHtmlMessage } from "@home-dashboard/integrations";

interface NotificationEvent {
  source: string;
  type: string;
  severity: string;
  title: string;
  payload: unknown;
  occurredAt: Date;
}

const severityLabels: Record<string, string> = { info: "Інформація", warning: "Увага", error: "Помилка", critical: "Критично" };
const sourceLabels: Record<string, string> = { marstek: "Marstek", freelancehunt: "Freelancehunt", system: "Система" };
const headings: Record<string, string> = {
  "freelancehunt.project_created": "💼 Новий проєкт",
  "freelancehunt.message_received": "✉️ Нове повідомлення",
  "marstek.battery_low": "🪫 Низький заряд батареї",
  "marstek.battery_recovered": "🔋 Заряд батареї відновлено",
  "marstek.fully_charged": "🔋 Батарею повністю заряджено",
  "marstek.device_offline": "📡 Пристрій недоступний",
  "marstek.device_online": "✅ Зв’язок із пристроєм відновлено",
  "system.service_unavailable": "🔴 Сервіс недоступний",
  "system.service_restored": "✅ Доступ до сервісу відновлено",
  "system.test_notification": "✅ Тестове сповіщення",
  "system.daily_digest": "📊 Добовий підсумок",
};
const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const numberFormat = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Bound escaped fragments individually so the final HTML stays below 4096 UTF-16
// units, including markup. Never cut through an entity or a Unicode code point.
function fragment(value: string, limit = 600): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  let result = "";
  for (const character of normalized) {
    const escaped = escapeHtml(character);
    if (result.length + escaped.length > limit - 1) return `${result}…`;
    result += escaped;
  }
  return result;
}

function freelancehuntUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "freelancehunt.com" || url.username || url.password || url.port) return null;
    const escaped = escapeHtml(url.href);
    return escaped.length <= 1400 ? escaped : null;
  } catch { return null; }
}

export function formatNotificationMessage(event: NotificationEvent): TelegramHtmlMessage {
  const payload: Record<string, unknown> = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
  const value = (key: string) => typeof payload[key] === "string" ? fragment(payload[key]) : "";
  const heading = Object.hasOwn(headings, event.type) ? headings[event.type] : undefined;
  const icon = event.severity === "critical" ? "🚨" : event.severity === "error" ? "🔴" : event.severity === "warning" ? "⚠️" : "ℹ️";
  const lines = [`<b>${heading ?? `${icon} ${fragment(event.title, 900)}`}</b>`];
  const details: string[] = [];
  const detail = (label: string, content: string) => { if (content) details.push(`${label}: <b>${content}</b>`); };
  if (event.type === "freelancehunt.project_created") {
    details.push(value("name") || fragment(event.title, 900));
    const amount = payload.budgetAmount;
    const currency = typeof payload.budgetCurrency === "string" && /^[A-Z]{3}$/.test(payload.budgetCurrency) ? payload.budgetCurrency : "";
    const budget = typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && currency ? `${numberFormat.format(amount)} ${currency}` : "Не вказано";
    detail("💰 Бюджет", fragment(budget));
  } else if (event.type === "freelancehunt.message_received") {
    detail("Тема", value("subject") || fragment(event.title, 900));
  } else if (event.source === "marstek") {
    detail("Пристрій", value("deviceId"));
    const soc = payload.socPercent;
    if (typeof soc === "number" && Number.isFinite(soc) && soc >= 0 && soc <= 100) detail("Заряд", `${numberFormat.format(soc)}%`);
    const threshold = payload.threshold;
    if (event.type === "marstek.battery_low" && typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 1 && threshold <= 90) detail("Поріг сповіщення", `${numberFormat.format(threshold)}%`);
  } else if (event.type === "system.daily_digest") {
    details.push(fragment(event.title, 200));
    if (typeof payload.summary === "string") details.push(fragment(payload.summary, 1800));
  } else if (event.type === "system.test_notification") {
    details.push("Канал налаштовано. Telegram-сповіщення надходять успішно.");
  } else if (event.type === "system.service_unavailable" || event.type === "system.service_restored") {
    detail("Сервіс", value("service"));
  }
  if (heading && !details.length) details.push(fragment(event.title, 900));
  if (details.length) lines.push(details.join("\n"));
  const url = event.source === "freelancehunt" ? freelancehuntUrl(payload.url) : null;
  if (url) lines.push(`<a href="${url}">${event.type === "freelancehunt.message_received" ? "Відкрити листування" : "Відкрити проєкт"} ↗</a>`);
  const source = Object.hasOwn(sourceLabels, event.source) ? sourceLabels[event.source] : fragment(event.source, 120);
  const severity = Object.hasOwn(severityLabels, event.severity) ? severityLabels[event.severity] : fragment(event.severity, 120);
  lines.push(`<i>${source} · ${severity}\n${dateFormat.format(event.occurredAt)} (Київ)</i>`);
  return { text: lines.join("\n\n"), parseMode: "HTML" };
}
