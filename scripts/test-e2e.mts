import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { WebSocket } from "ws";
import { SignJWT } from "jose";
import { hashPassword } from "../apps/web/src/server/auth/password";
import { getDatabase, disconnectDatabase } from "../packages/database/src/client";
import { saveMarstekReading, syncMarstekDevices } from "@home-dashboard/database";
import { publishEvent } from "../packages/database/src/events";
import { toMarstekReading } from "@home-dashboard/integrations";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("Set TEST_DATABASE_ADMIN_URL to a disposable PostgreSQL server");
const admin = new pg.Client({ connectionString: adminUrl }); await admin.connect();
const name = `dashboard_${process.pid}_e2e_test`, url = new URL(adminUrl); url.pathname = `/${name}`;
const port = process.env.E2E_PORT ?? "3491", base = `http://127.0.0.1:${port}`;
const secret = "synthetic-e2e-session-secret-at-least-32-bytes";
const password = "synthetic-e2e-password";
let server: ReturnType<typeof spawn> | undefined, browser: { close(): Promise<void> } | undefined;
await admin.query(`CREATE DATABASE "${name}"`);
try {
  process.env.DATABASE_URL = url.href; process.env.AUTH_JWT_SECRET = secret;
  const migrated = spawnSync("npm", ["run", "db:migrate"], { env: process.env, stdio: "inherit" });
  assert.equal(migrated.status, 0);
  const db = getDatabase();
  const user = await db.user.create({ data: { firstName: "Тест", lastName: "Браузер", login: "browser-test", passwordHash: await hashPassword(password) } });
  const device = { id: "e2e-battery", name: "Тестова батарея", host: "127.0.0.1", port: 30000 };
  await syncMarstekDevices([device]);
  const minute = Math.floor(Date.now()/60000)*60000;
  for (let offset = 80; offset >= 1; offset--) await saveMarstekReading(device.id, toMarstekReading({ bat_soc: 70, bat_power: -100 }, { bat_temp: 25 + offset / 80, bat_capacity: 2000, rated_capacity: 3000 }, null, new Date(minute-offset*60000)));
  for (let index=0; index<25; index++) await publishEvent({ source: "system", type: "system.browser_test", severity: "info", title: `Тестове сповіщення ${index}`, telegram: false });
  await db.freelancehuntProject.create({ data: { externalId: 123, name: "Тестовий проєкт", description: "Опис для тесту", url: "https://freelancehunt.com/project/123.html", publishedAt: new Date() } });
  server = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], { cwd: new URL("../apps/web", import.meta.url), env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: port, FREELANCEHUNT_API_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = ""; server.stdout?.on("data", chunk => { logs = (logs + chunk).slice(-12000); }); server.stderr?.on("data", chunk => { logs = (logs + chunk).slice(-12000); });
  let ready = false;
  for (let attempt=0; attempt<120; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited: ${logs}`);
    try { if ((await fetch(`${base}/api/health`)).ok) { ready=true; break; } } catch { /* Wait for server prepare. */ }
    await new Promise(resolve => setTimeout(resolve,250));
  }
  assert.ok(ready, `Server did not become ready: ${logs}`);
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
  const launched = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) }); browser = launched;
  const context = await launched.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel("Логін", { exact: true }).fill("browser-test"); await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click(); await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Температура батареї", exact: true }).waitFor();
  const chart = page.locator(".recharts-wrapper").first();
  const dot = chart.locator(".recharts-area-dot").last(); await dot.waitFor();
  await dot.scrollIntoViewIfNeeded();
  const box = await dot.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  const tooltip = page.locator(".recharts-tooltip-wrapper").first(); await tooltip.waitFor({ state: "visible" });
  assert.ok(!(await tooltip.innerText()).includes("Invalid Date")); assert.match(await tooltip.innerText(), /\d{4}/);
  await mkdir("test-results", { recursive: true }); await page.screenshot({ path: "test-results/energy-desktop.png", fullPage: true });
  assert.equal((await context.request.get(`${base}/api/marstek/export?device=${device.id}&range=24`)).status(),200);
  assert.equal((await context.request.post(`${base}/api/notifications/read`, { headers: { origin: "https://untrusted.example" }, data: { all: true } })).status(),403);

  await page.goto(`${base}/dashboard?tab=freelancehunt&project=123`);
  const dialog = page.getByRole("dialog"); await dialog.waitFor();
  await dialog.getByLabel("Особиста нотатка").fill("Збережена браузерна нотатка");
  await dialog.getByRole("button", { name: "Зберегти нотатку", exact: true }).click(); await dialog.getByText("Нотатку збережено.", { exact: true }).waitFor();
  await dialog.getByLabel("Робочий статус").selectOption("applied");
  await page.waitForTimeout(600);
  const state = await db.freelancehuntProjectState.findFirstOrThrow({ where: { userId: user.id } });
  assert.equal(state.workflow,"applied"); assert.ok(state.viewedAt);
  await page.goto(`${base}/notifications`); await page.getByRole("link", { name: "Далі", exact: true }).click(); await page.waitForURL("**/notifications?page=2**");
  assert.ok((await page.locator("article").count()) >= 5);
  await page.goto(`${base}/settings/sites`);
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Додати сайт", exact: true }) });
  await form.getByLabel("Назва", { exact: true }).fill("Браузерний сайт"); await form.getByLabel("HTTPS-адреса", { exact: true }).fill("https://example.com/");
  await form.getByRole("button", { name: "Зберегти", exact: true }).click(); await page.getByRole("heading", { name: "Браузерний сайт", exact: true }).waitFor();
  await page.goto(`${base}/dashboard`); await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Температура батареї", exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: "test-results/energy-mobile.png", fullPage: true });

  // Exercise the complete PostgreSQL NOTIFY -> authenticated socket boundary.
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuer("home-dashboard").setAudience("home-dashboard-web").setExpirationTime("60s").sign(new TextEncoder().encode(secret));
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/events`, { headers: { origin: base, cookie: `home_dashboard_session=${token}` } });
  await new Promise<void>((resolve,reject) => { socket.once("open",resolve); socket.once("error",reject); });
  const received = new Promise<void>((resolve,reject) => { const timer=setTimeout(()=>reject(new Error("NOTIFY not received")),5000); socket.on("message", data=>{ if(JSON.parse(String(data)).type==="notifications.changed"){ clearTimeout(timer); resolve(); } }); });
  await publishEvent({ source: "system", type: "system.browser_live", severity: "info", title: "Live-перевірка", telegram: false }); await received; socket.close();
  const shortToken = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuer("home-dashboard").setAudience("home-dashboard-web").setExpirationTime("2s").sign(new TextEncoder().encode(secret));
  const expiring = new WebSocket(`ws://127.0.0.1:${port}/api/events`, { headers: { origin: base, cookie: `home_dashboard_session=${shortToken}` } });
  const closeCode = await new Promise<number>((resolve,reject) => { const timer=setTimeout(()=>reject(new Error("Socket session did not expire")),5000); expiring.once("close", code=>{ clearTimeout(timer); resolve(code); }); expiring.once("error",reject); });
  assert.equal(closeCode,4401);
  await db.marstekMeasurement.updateMany({ where: { deviceId: device.id }, data: { sampledAt: new Date(Date.now()-240000) } });
  await page.evaluate(() => window.dispatchEvent(new Event("marstek.measurement.saved")));
  await page.getByText("Пристрій недоступний", { exact: true }).waitFor({ timeout:15000 });
  assert.deepEqual(errors,[]);
  console.info("Browser: login, temperature/tooltip, CSV, CSRF, notes/workflow, inbox pagination, sites, mobile, NOTIFY, socket expiry and stale telemetry passed.");
} finally {
  await browser?.close();
  if (server) { server.kill("SIGTERM"); await new Promise(resolve=>{ if(server!.exitCode!==null) resolve(null); else { server!.once("exit",resolve); setTimeout(()=>{server!.kill("SIGKILL");resolve(null);},5000).unref(); } }); }
  await disconnectDatabase(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
}
