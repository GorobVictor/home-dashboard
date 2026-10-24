import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { WebSocket } from "ws";
import { SignJWT } from "jose";
import { hashPassword } from "../apps/web/src/server/auth/password";
import { getDatabase, disconnectDatabase } from "../packages/database/src/client";
import { saveMarstekReading, syncMarstekDevices, recordHealth } from "@home-dashboard/database";
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
  for (const service of ["worker", "freelancehunt", "freelancehunt.projects", "freelancehunt.threads"]) await recordHealth(service, true);
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
  await page.route("**/api/freelancehunt/skills", route => route.fulfill({ json: [{ id: 24, name: "Веб-програмування", groupName: "Розробка" }, { id: 86, name: "Дизайн інтерфейсів", groupName: "Дизайн" }] }));
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel("Логін", { exact: true }).fill("browser-test"); await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click(); await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Температура батареї", exact: true }).waitFor();
  const chart = page.locator(".recharts-wrapper").first();
  const dot = chart.locator(".recharts-area-dot").last(); await dot.waitFor();
  // Hover retries if the initial live refresh replaces the chart's SVG nodes.
  await dot.hover({ force: true });
  const tooltip = page.locator(".recharts-tooltip-wrapper").first(); await tooltip.waitFor({ state: "visible" });
  assert.ok(!(await tooltip.innerText()).includes("Invalid Date")); assert.match(await tooltip.innerText(), /\d{4}/);
  await mkdir("test-results", { recursive: true }); await page.screenshot({ path: "test-results/energy-desktop.png", fullPage: true });
  assert.equal((await context.request.get(`${base}/api/marstek/export?device=${device.id}&range=24`)).status(),200);
  assert.equal((await context.request.post(`${base}/api/notifications/read`, { headers: { origin: "https://untrusted.example" }, data: { all: true } })).status(),403);

  await page.goto(`${base}/settings/notifications`);
  const channelForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Додати Telegram-канал", exact: true }) });
  await channelForm.waitFor({ state: "visible" });
  assert.equal(await channelForm.getByRole("checkbox", { name: /Електромережу/ }).count(), 0);
  assert.equal(await channelForm.getByRole("checkbox", { name: "Новий проєкт", exact: true }).count(), 1);
  assert.equal(await channelForm.getByRole("checkbox", { name: "Пристрій недоступний", exact: true }).count(), 1);
  const digest = channelForm.getByRole("checkbox", { name: "Добовий підсумок", exact: true });
  const digestHelp = channelForm.getByRole("button", { name: "Пояснення: Добовий підсумок", exact: true });
  await digestHelp.hover();
  await page.getByRole("tooltip").waitFor({ state: "visible" });
  assert.match(await page.getByRole("tooltip").innerText(), /Окремі події продовжують надходити/);
  assert.equal(await digest.isChecked(), false);
  await page.keyboard.press("Escape");
  await page.getByRole("tooltip").waitFor({ state: "hidden" });
  await digestHelp.focus(); await digestHelp.press("Enter");
  await page.getByRole("tooltip").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await channelForm.getByLabel("Назва каналу", { exact: true }).fill("Тестовий канал із підсумком");
  await channelForm.getByLabel("ID чату", { exact: true }).fill("-12345");
  await digest.check();
  await channelForm.getByRole("button", { name: "Зберегти", exact: true }).click();
  await page.getByRole("heading", { name: "Тестовий канал із підсумком", exact: true }).waitFor();
  assert.equal((await db.notificationChannel.findFirstOrThrow({ where: { chatId: "-12345" } })).digest, true);
  // A touch help trigger must neither toggle the option nor submit the form.
  const mobile = await launched.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await context.storageState() });
  const mobilePage = await mobile.newPage(); mobilePage.on("pageerror", error => errors.push(error.message));
  await mobilePage.goto(`${base}/settings/notifications`);
  const savedChannel = mobilePage.locator("form").filter({ has: mobilePage.getByRole("heading", { name: "Тестовий канал із підсумком", exact: true }) });
  await savedChannel.getByRole("button", { name: "Пояснення: Добовий підсумок", exact: true }).tap();
  await mobilePage.getByRole("tooltip").waitFor({ state: "visible" });
  assert.equal(await savedChannel.getByRole("checkbox", { name: "Добовий підсумок", exact: true }).isChecked(), true);
  const helpBox = await mobilePage.getByRole("tooltip").boundingBox(); assert.ok(helpBox && helpBox.x >= 0 && helpBox.x + helpBox.width <= 391);
  assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await mobilePage.screenshot({ path: "test-results/notification-help-mobile.png", fullPage: true });
  await mobile.close();

  await page.goto(`${base}/dashboard?tab=freelancehunt&project=123`);
  const dialog = page.getByRole("dialog"); await dialog.waitFor();
  await dialog.getByRole("textbox", { name: "Особиста нотатка", exact: true }).fill("Збережена браузерна нотатка");
  await dialog.getByRole("button", { name: "Зберегти нотатку", exact: true }).click(); await dialog.getByText("Нотатку збережено.", { exact: true }).waitFor();
  await dialog.getByRole("combobox", { name: "Робочий статус", exact: true }).selectOption("applied");
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

  if (process.env.E2E_UI_MATRIX === "1") {
    await mkdir("test-results/ui", { recursive: true });
    const screens = [
      { name: "energy", path: "/dashboard", ready: () => page.getByRole("heading", { name: "Температура батареї", exact: true }) },
      { name: "projects", path: "/dashboard?tab=freelancehunt", ready: () => page.locator("summary").filter({ hasText: "Фільтри проєктів" }) },
      { name: "sites-tab", path: "/dashboard?tab=sites", ready: () => page.getByRole("heading", { name: "Усі сервіси під рукою", exact: true }) },
      { name: "settings", path: "/settings", ready: () => page.getByRole("heading", { name: "Моніторинг", exact: true }) },
      { name: "channels", path: "/settings/notifications", ready: () => page.getByRole("heading", { name: "Тестовий канал із підсумком", exact: true }) },
      { name: "events", path: "/events", ready: () => page.getByText(/^Подій: /).first() },
      { name: "inbox", path: "/notifications", ready: () => page.locator("article").first() },
      { name: "sites", path: "/settings/sites", ready: () => page.getByRole("heading", { name: "Додати сайт", exact: true }) },
      { name: "status", path: "/status", ready: () => page.locator('section[aria-label="Загальний стан"]') },
    ];
    async function checkLayout(label: string, width: number) {
      // Let ResizeObserver/chart measurements settle after navigation or resizing.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
      if (dimensions.content > dimensions.viewport + 1) {
        const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(element => element.checkVisibility({ checkOpacity: true })).map(element => {
          const rect = element.getBoundingClientRect(); return { tag: element.tagName, classes: element.getAttribute("class"), text: element.textContent?.slice(0, 100), left: rect.left, right: rect.right };
        }).filter(element => element.left < -1 || element.right > window.innerWidth + 1).slice(0, 20));
        console.error("UI overflow diagnostics", label, width, JSON.stringify(overflow));
        await page.screenshot({ path: `test-results/ui/overflow-${label}-${width}.png`, fullPage: true, animations: "disabled" });
      }
      assert.ok(dimensions.content <= dimensions.viewport + 1, `${label}@${width}: page overflows ${JSON.stringify(dimensions)}`);
      const controls = await page.locator('input:not([type="hidden"]):not([type="checkbox"]), select, textarea, [data-slot="select-trigger"]').evaluateAll(elements => elements.filter(element => element.checkVisibility({ checkOpacity: true }) && !element.closest('[aria-hidden="true"],[inert]')).map(element => {
        const box = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { name: element.getAttribute("aria-label") ?? element.getAttribute("name"), top: box.top, left: box.left, right: box.right, height: box.height, radius: style.borderRadius, background: style.backgroundColor, font: parseFloat(style.fontSize), weight: style.fontWeight, border: style.borderColor, padding: style.paddingLeft, textarea: element.tagName === "TEXTAREA" };
      }));
      for (const control of controls) {
        assert.ok(control.left >= -1 && control.right <= width + 1, `${label}@${width}: clipped field ${JSON.stringify(control)}`);
        assert.ok(control.height >= 43.5, `${label}@${width}: short field ${JSON.stringify(control)}`);
        if (width < 640) assert.ok(control.font >= 16, `${label}@${width}: iOS zoom risk ${JSON.stringify(control)}`);
      }
      const headerActions = await page.locator('header nav[aria-label="Дії сторінки"] :is(button,a)').evaluateAll(elements => elements.filter(element => element.checkVisibility()).map(element => ({ name: element.getAttribute("aria-label"), height: element.getBoundingClientRect().height })));
      assert.equal(headerActions.length, 5, `${label}@${width}: header actions changed`);
      assert.equal(await page.locator('header nav svg').count(), 5, `${label}@${width}: a static action icon is missing`);
      assert.equal(await page.getByTestId("user-greeting").count(), 1);
      assert.equal(await page.getByTestId("user-greeting").innerText(), "Вітаю, Тест.");
      const frame = await page.evaluate(() => {
        const header = document.querySelector(".app-header")!.getBoundingClientRect();
        const content = document.querySelector("#main-content")!.getBoundingClientRect();
        return { headerTop: header.top + scrollY, height: header.height, left: content.left, width: content.width, contentTop: content.top + scrollY, padding: parseFloat(getComputedStyle(document.querySelector("#main-content")!).paddingTop) };
      });
      assert.equal(frame.headerTop, 0, `${label}@${width}: top spacing differs`);
      assert.equal(frame.height, width < 640 ? 160 : 128, `${label}@${width}: header height differs`);
      assert.equal(frame.contentTop, frame.height, `${label}@${width}: content start differs`);
      assert.equal(frame.padding, width < 640 ? 24 : 32, `${label}@${width}: content padding differs`);
      const reference = shellFrames.get(width);
      if (reference) assert.deepEqual(frame, reference, `${label}@${width}: shared frame moved`);
      else shellFrames.set(width, frame);
      for (const action of headerActions) assert.ok(action.height >= 43.5, `${label}@${width}: inconsistent header ${JSON.stringify(action)}`);
      return controls;
    }
    const shellFrames = new Map<number, { headerTop: number; height: number; left: number; width: number; contentTop: number; padding: number }>();
    for (const width of [390, 1440, 320, 430, 768]) {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
      for (const screen of screens) {
        if (screen.name === "status") await recordHealth("worker", true);
        await page.goto(`${base}${screen.path}`); await screen.ready().waitFor();
        if (screen.name === "projects") await screen.ready().click();
        if (screen.name === "events" && width < 640) await page.getByRole("button", { name: "Фільтри подій", exact: true }).click();
        const controls = await checkLayout(screen.name, width);
        if (screen.name === "projects") {
          const inputs = controls.filter(control => ["Мінімальний бюджет", "Максимальний бюджет", "Валюта (ISO)"].includes(control.name ?? ""));
          assert.equal(new Set(inputs.map(control => `${control.height}|${control.radius}|${control.background}`)).size, 1, "Budget fields use different styling");
          const stateControl = controls.find(control => control.name === "Стан"); assert.ok(stateControl);
          const fieldStyle = (control: typeof stateControl) => `${control.height}|${control.radius}|${control.background}|${control.font}|${control.weight}|${control.border}|${control.padding}`;
          assert.equal(fieldStyle(stateControl), fieldStyle(inputs[0]), "Select and input styling differs");
          if (width >= 640) assert.ok(Math.abs(stateControl.top - inputs[width >= 1280 ? 0 : 2].top) <= 1, `Field rows do not align at ${width}px`);
          await page.getByRole("combobox", { name: "Стан", exact: true }).click();
          await page.getByRole("option", { name: "Усі видимі", exact: true }).waitFor();
          await checkLayout("project-select", width); await page.keyboard.press("Escape");
          await page.getByRole("listbox").waitFor({ state: "hidden" });
          await page.getByRole("button", { name: /^Навички/ }).click();
          await page.getByRole("dialog").waitFor(); await checkLayout("project-skills", width); await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        }
        if (width === 390 || width === 1440) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `test-results/ui/${screen.name}-${width}.png`, fullPage: true, animations: "disabled" });
          if (screen.name === "energy") await page.locator("header").screenshot({ path: `test-results/ui/header-${width}.png`, animations: "disabled" });
        }
        console.info(`UI ${screen.name}@${width}: layout, fields and header passed`);
      }
    }
    // Hold only disposable test tables so the real loading.tsx is streamed.
    // This catches a fallback with missing icons, another header or a shifted frame.
    const blocker = new pg.Client({ connectionString: url.href });
    await blocker.connect();
    try {
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
        for (const target of [
          { path: "/dashboard", table: "marstek_devices", ready: () => page.getByRole("heading", { name: "Температура батареї", exact: true }) },
          { path: "/dashboard?tab=freelancehunt", table: "freelancehunt_preferences", ready: () => page.locator("summary").filter({ hasText: "Фільтри проєктів" }) },
          { path: "/dashboard?tab=sites", table: "sites", ready: () => page.getByRole("heading", { name: "Усі сервіси під рукою", exact: true }) },
          { path: "/settings", table: "freelancehunt_settings", ready: () => page.getByRole("heading", { name: "Моніторинг", exact: true }) },
          { path: "/settings/notifications", table: "notification_channels", ready: () => page.getByRole("heading", { name: "Тестовий канал із підсумком", exact: true }) },
          { path: "/settings/sites", table: "sites", ready: () => page.getByRole("heading", { name: "Додати сайт", exact: true }) },
          { path: "/events", table: "events", ready: () => page.getByText(/^Подій: /).first() },
          { path: "/notifications", table: "notifications", ready: () => page.locator("article").first() },
          { path: "/status", table: "marstek_devices", ready: () => page.locator('section[aria-label="Загальний стан"]') },
        ]) {
          await blocker.query("BEGIN");
          let loadingCards: { top: number; height: number; width: number }[] | undefined;
          try {
            await blocker.query(`LOCK TABLE ${target.table} IN ACCESS EXCLUSIVE MODE`);
            await page.goto(`${base}${target.path}`, { waitUntil: "commit" });
            await page.locator('#main-content [aria-busy="true"]').first().waitFor();
            await checkLayout(`loading-${target.path}`, width);
            assert.equal(await page.locator("header").count(), 1);
            assert.equal(await page.locator('header [data-slot="skeleton"]').count(), 0);
            if (target.path === "/dashboard") assert.equal(await page.getByRole("navigation", { name: "Розділи дашборда", exact: true }).getByRole("link").count(), 3);
            if (target.path === "/dashboard") loadingCards = await page.locator('section[aria-label="Поточний стан енергії"] [data-slot="card"]').evaluateAll(elements => elements.filter(element => element.checkVisibility()).map(element => { const box = element.getBoundingClientRect(); return { top: box.top, height: box.height, width: box.width }; }));
            await page.screenshot({ path: `test-results/ui/loading-${target.path.slice(1).replaceAll(/[/?=]/g, "-")}-${width}.png`, fullPage: false, animations: "disabled" });
          } finally { await blocker.query("ROLLBACK"); }
          await target.ready().waitFor();
          await page.locator('#main-content [aria-busy="true"]').waitFor({ state: "hidden" });
          await checkLayout(`loaded-${target.path}`, width);
          if (loadingCards) {
            const loaded = await page.locator('section[aria-label="Поточний стан енергії"] [data-slot="card"]').evaluateAll(elements => elements.filter(element => element.checkVisibility()).map(element => { const box = element.getBoundingClientRect(); return { top: box.top, height: box.height, width: box.width }; }));
            assert.equal(loaded.length, loadingCards.length);
            for (let index = 0; index < loaded.length; index++) {
              assert.equal(loaded[index].width, loadingCards[index].width);
              assert.ok(Math.abs(loaded[index].top - loadingCards[index].top) <= 4, `Energy card ${index} moved at ${width}px: ${JSON.stringify({ loaded: loaded[index], loading: loadingCards[index] })}`);
              assert.ok(Math.abs(loaded[index].height - loadingCards[index].height) <= 4, `Energy card ${index} resized at ${width}px: ${JSON.stringify({ loaded: loaded[index], loading: loadingCards[index] })}`);
            }
          }
        }
      }
    } finally { await blocker.end(); }
    // Client navigation must retain the actual header DOM, not replace it with a fallback.
    await page.goto(`${base}/dashboard`);
    await page.getByRole("heading", { name: "Температура батареї", exact: true }).waitFor();
    await page.locator("header").evaluate(element => element.setAttribute("data-navigation-marker", "persistent"));
    await page.locator("header").getByRole("link", { name: "Налаштування", exact: true }).click();
    await page.waitForURL("**/settings");
    await page.getByRole("heading", { name: "Моніторинг", exact: true }).waitFor();
    assert.equal(await page.locator("header").getAttribute("data-navigation-marker"), "persistent");
    await page.locator("header").getByRole("link", { name: "Стан системи", exact: true }).click();
    await page.waitForURL("**/status");
    assert.equal(await page.locator("header").getAttribute("data-navigation-marker"), "persistent");
    console.info("Shared shell: consistent frame, five icons and greeting on every screen; real loading transitions and persistent client navigation passed.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/dashboard?tab=freelancehunt`);
    await page.locator("summary").filter({ hasText: "Фільтри проєктів" }).click();
    await page.getByRole("textbox", { name: "Назва нового набору", exact: true }).fill("UI-набір");
    await page.getByRole("button", { name: "Зберегти набір", exact: true }).click();
    await page.getByText(/Набір збережено/).waitFor();
    const preset = page.getByRole("combobox", { name: "Набір фільтрів", exact: true });
    await preset.click(); await page.getByRole("option", { name: "UI-набір", exact: true }).click();
    await page.getByRole("button", { name: "Видалити", exact: true }).click();
    await preset.waitFor({ state: "hidden" });
    assert.equal(await db.freelancehuntPreset.count({ where: { userId: user.id } }), 0);
    await page.goto(`${base}/settings/sites`);
    const invalidSite = page.locator("form").filter({ has: page.getByRole("heading", { name: "Додати сайт", exact: true }) });
    await invalidSite.getByLabel("Назва", { exact: true }).fill("Не втрачати введені дані");
    await invalidSite.getByLabel("HTTPS-адреса", { exact: true }).fill("http://example.com/");
    await invalidSite.getByRole("button", { name: "Зберегти", exact: true }).click();
    await invalidSite.getByRole("alert").waitFor();
    assert.equal(await invalidSite.getByLabel("Назва", { exact: true }).inputValue(), "Не втрачати введені дані");
    assert.equal(await db.site.count({ where: { name: "Не втрачати введені дані" } }), 0);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${base}/dashboard?tab=freelancehunt&project=123`);
    const smallDialog = page.getByRole("dialog"); await smallDialog.waitFor();
    assert.ok(await smallDialog.evaluate(element => element.scrollHeight > element.clientHeight));
    await smallDialog.getByRole("textbox", { name: "Особиста нотатка", exact: true }).fill("Мобільна нотатка");
    await smallDialog.getByRole("button", { name: "Зберегти нотатку", exact: true }).click();
    await smallDialog.getByText("Нотатку збережено.", { exact: true }).waitFor();
    await checkLayout("project-dialog", 320);
    await smallDialog.getByRole("link", { name: "Відкрити на Freelancehunt", exact: true }).scrollIntoViewIfNeeded();
    const close = smallDialog.getByRole("button", { name: "Закрити", exact: true });
    const closeBounds = await close.boundingBox(); assert.ok(closeBounds && closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= 640);
    await page.screenshot({ path: "test-results/ui/project-dialog-320.png", animations: "disabled" });
    await close.click(); await smallDialog.waitFor({ state: "hidden" });
    await page.goto(`${base}/dashboard`);
    await page.getByRole("heading", { name: "Температура батареї", exact: true }).waitFor();
    console.info("UI matrix: nine screens at 320/390/430/768/1440px plus selects, multiselect, presets, failed form retention and 320px dialog passed.");
  }

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
  console.info("Browser: login, temperature/tooltip, CSV, CSRF, additional digest settings, hover/keyboard/touch help, notes/workflow, inbox pagination, sites, mobile, NOTIFY, socket expiry and stale telemetry passed.");
} finally {
  await browser?.close();
  if (server) { server.kill("SIGTERM"); await new Promise(resolve=>{ if(server!.exitCode!==null) resolve(null); else { server!.once("exit",resolve); setTimeout(()=>{server!.kill("SIGKILL");resolve(null);},5000).unref(); } }); }
  await disconnectDatabase(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
}
