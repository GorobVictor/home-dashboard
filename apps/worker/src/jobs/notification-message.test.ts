import assert from "node:assert/strict";
import { test } from "node:test";
import { formatNotificationMessage } from "./notification-message";

const base = { source: "freelancehunt", type: "freelancehunt.project_created", title: "Новий проєкт: Backend API", severity: "info", occurredAt: new Date("2026-10-17T10:05:06Z"), payload: { name: "Backend API", budgetAmount: 15000, budgetCurrency: "UAH", url: "https://freelancehunt.com/project/backend/123.html" } };

test("project notification contains a heading, budget, named link and Kyiv time", () => {
  const message = formatNotificationMessage(base);
  assert.equal(message.parseMode, "HTML");
  assert.equal(message.text, [
    "<b>💼 Новий проєкт</b>",
    "Backend API\n💰 Бюджет: <b>15 000 UAH</b>",
    '<a href="https://freelancehunt.com/project/backend/123.html">Відкрити проєкт ↗</a>',
    "<i>Freelancehunt · Інформація\n17.10.2026, 13:05:06 (Київ)</i>",
  ].join("\n\n"));
});

test("all untrusted text and URL attributes are escaped without interpreting markup", () => {
  const message = formatNotificationMessage({ ...base, payload: { ...base.payload, name: '<b>API & "CMS"</b>\n💰 Fake budget', url: 'https://freelancehunt.com/project/123?a=1&b="x"' } });
  assert.match(message.text, /&lt;b&gt;API &amp; &quot;CMS&quot;&lt;\/b&gt; 💰 Fake budget/);
  assert.match(message.text, /\?a=1&amp;b=%22x%22/);
  assert.ok(!message.text.includes('<b>API'));
});

test("missing budgets are honest and zero budgets remain visible", () => {
  for (const payload of [null, [], "text", { budgetAmount: -1, budgetCurrency: "USD" }, { budgetAmount: Infinity, budgetCurrency: "UAH" }, { budgetAmount: 500 }]) {
    assert.match(formatNotificationMessage({ ...base, payload }).text, /Бюджет: <b>Не вказано<\/b>/);
  }
  assert.match(formatNotificationMessage({ ...base, payload: { budgetAmount: 0, budgetCurrency: "USD" } }).text, /Бюджет: <b>0 USD<\/b>/);
});

test("links reject unsafe protocols, lookalike hosts, credentials and malformed URLs", () => {
  for (const url of ["javascript:alert(1)", "http://freelancehunt.com/project/1", "https://freelancehunt.com.evil.test/", "https://freelancehunt.com@evil.test/", "https://evil.test@freelancehunt.com/", "https://freelancehunt.com:444/", "https://freelancehunt.com/\npath", "not a URL", "https://freelancehunt.com/" + "x".repeat(2000)]) {
    assert.ok(!formatNotificationMessage({ ...base, payload: { ...base.payload, url } }).text.includes("<a href="), url);
  }
  assert.ok(!formatNotificationMessage({ ...base, source: "system" }).text.includes("<a href="));
});

test("message notifications emphasize the subject and link to the conversation", () => {
  const text = formatNotificationMessage({ ...base, type: "freelancehunt.message_received", payload: { subject: "API <review>", url: "https://freelancehunt.com/mailbox/read/thread/123" } }).text;
  assert.match(text, /<b>✉️ Нове повідомлення<\/b>/);
  assert.match(text, /Тема: <b>API &lt;review&gt;<\/b>/);
  assert.match(text, /Відкрити листування ↗/);
  assert.ok(!text.includes("Бюджет"));
});

test("Marstek notifications show validated charge and threshold without inventing telemetry", () => {
  const event = { ...base, source: "marstek", type: "marstek.battery_low", severity: "warning", payload: { deviceId: "venus-e3-1", socPercent: 15.5, threshold: 20 } };
  const text = formatNotificationMessage(event).text;
  assert.match(text, /Пристрій: <b>venus-e3-1<\/b>\nЗаряд: <b>15,5%<\/b>\nПоріг сповіщення: <b>20%<\/b>/);
  assert.match(text, /Marstek · Увага/);
  for (const socPercent of [null, "15", -1, 101, NaN]) {
    assert.ok(!formatNotificationMessage({ ...event, payload: { deviceId: "venus", socPercent } }).text.includes("Заряд:"));
  }
});

test("Service health and channel test notifications use readable details", () => {
  const system = formatNotificationMessage({ ...base, source: "system", type: "system.service_unavailable", severity: "error", payload: { service: "freelancehunt" } }).text;
  assert.match(system, /Сервіс: <b>freelancehunt<\/b>/);
  assert.match(system, /Система · Помилка/);
  const testMessage = formatNotificationMessage({ ...base, source: "system", type: "system.test_notification", payload: { userId: "private-user-id" } }).text;
  assert.match(testMessage, /Канал налаштовано/);
  assert.ok(!testMessage.includes("private-user-id"));
});

test("unknown events preserve the title, escape markup and ignore arbitrary payload fields", () => {
  const text = formatNotificationMessage({ ...base, source: "custom", type: "custom.future", severity: "critical", title: "Something <changed>", payload: { secret: "must not appear" } }).text;
  assert.match(text, /<b>🚨 Something &lt;changed&gt;<\/b>/);
  assert.match(text, /custom · Критично/);
  assert.ok(!text.includes("must not appear"));
});

test("large escaped and emoji fields stay bounded with complete tags and entities", () => {
  for (const content of ["<&\"".repeat(5000), "🔋".repeat(5000)]) {
    const text = formatNotificationMessage({ ...base, title: content, payload: { name: content, budgetAmount: Number.MAX_VALUE, budgetCurrency: "USD", url: "https://freelancehunt.com/" + "a".repeat(900) } }).text;
    assert.ok(text.length <= 4096);
    assert.ok(text.endsWith("</i>"));
    assert.ok(!/[\uD800-\uDFFF]/u.test(text));
    assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(text));
    assert.equal((text.match(/<b>/g) ?? []).length, (text.match(/<\/b>/g) ?? []).length);
    assert.match(text, /…/);
  }
});

test("Kyiv time automatically follows winter and summer offsets", () => {
  const text = formatNotificationMessage({ ...base, occurredAt: new Date("2026-12-17T10:05:06Z") }).text;
  assert.match(text, /17.12.2026, 12:05:06 \(Київ\)/);
});
