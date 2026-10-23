import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { Client } from "pg";
import { getDatabase, disconnectDatabase } from "./client";
import { observeMarstekAvailability } from "./events";

const testUrl = process.env.MARSTEK_TEST_DATABASE_URL;
test("PostgreSQL persists confirmed Marstek availability and publishes only stable transitions", { skip: !testUrl }, async () => {
  assert.match(new URL(testUrl!).pathname, /_marstek_test$/);
  process.env.DATABASE_URL = testUrl;
  const at = (seconds: number) => new Date(Date.UTC(2026, 9, 23) + seconds * 1000);
  const deviceId = "availability-test";
  const key = `device:${deviceId}`;
  const observe = (available: boolean, seconds: number) => getDatabase().$transaction((tx) => observeMarstekAvailability(tx, deviceId, available, at(seconds)));
  const listener = new Client({ connectionString: testUrl });
  try {
    await listener.connect();
    await listener.query("LISTEN home_dashboard_events");
    const db = getDatabase();
    const user = await db.user.create({ data: { login: "availability-test", firstName: "Test", lastName: "User", passwordHash: "not-a-real-password" } });
    await observe(true, 0);
    await observe(false, 3600);
    await observe(true, 3602);
    assert.equal(await db.event.count(), 0);
    for (let seconds = 3603; seconds <= 3782; seconds++) await observe(false, seconds);
    assert.equal(await db.event.count(), 0);
    // Reconnect the Prisma client mid-confirmation; state must survive.
    await disconnectDatabase();
    const offlineNotice = once(listener, "notification", { signal: AbortSignal.timeout(5000) });
    const offline = await observe(false, 3783);
    assert.equal(offline?.type, "marstek.device_offline");
    assert.equal(JSON.parse((await offlineNotice)[0].payload).type, "notifications.changed");
    await observe(false, 3784);
    for (let seconds = 3785; seconds <= 3800; seconds++) await observe(true, seconds);
    await observe(false, 3801);
    await observe(true, 3802);
    // Resume after a long pause: the recovery window must restart.
    for (let seconds = 7200; seconds < 7230; seconds++) {
      assert.equal(await observe(true, seconds), null);
    }
    const onlineNotice = once(listener, "notification", { signal: AbortSignal.timeout(5000) });
    const online = await observe(true, 7230);
    assert.equal(online?.type, "marstek.device_online");
    assert.equal(JSON.parse((await onlineNotice)[0].payload).type, "notifications.changed");
    await observe(true, 7231);
    const events = await getDatabase().event.findMany({ orderBy: { occurredAt: "asc" } });
    assert.deepEqual(events.map((event) => event.type), ["marstek.device_offline", "marstek.device_online"]);
    assert.equal(await getDatabase().notification.count({ where: { userId: user.id } }), 2);
    const state = await getDatabase().eventState.findUniqueOrThrow({ where: { key } });
    assert.equal(state.value, "online");
    assert.equal(state.candidateValue, null);
    assert.equal(state.lastEventAt?.getTime(), at(7230).getTime());
  } finally {
    await listener.end();
    await disconnectDatabase();
  }
});
