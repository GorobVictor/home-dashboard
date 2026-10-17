import assert from "node:assert/strict";
import { test } from "node:test";
import { disconnectDatabase, getDatabase } from "./client";
import { getDockerStatus, listDockerContainers, listDockerHistory, markMissingDockerContainers, pruneDockerMonitoring, saveDockerObservation } from "./docker";

const testUrl = process.env.DOCKER_TEST_DATABASE_URL;

test("Docker inventory follows container replacement while preserving history", { skip: !testUrl }, async (t) => {
  assert.match(new URL(testUrl!).pathname, /_docker_test$/);
  process.env.DATABASE_URL = testUrl;
  const db = getDatabase();
  const sampledAt = new Date();
  const oldId = "a".repeat(64);
  const currentId = "b".repeat(64);
  const stoppedId = "c".repeat(64);
  const unhealthyId = "d".repeat(64);
  const currentIds = [currentId, stoppedId, unhealthyId];
  try {
    await db.dockerEngine.create({ data: { id: "default" } });
    await db.dockerContainer.createMany({ data: [
      { id: oldId, name: "home-dashboard-web", image: "previous-image", state: "running", health: "unhealthy", lastSeenAt: new Date(sampledAt.getTime() - 60_000) },
      { id: currentId, name: "home-dashboard-web", image: "current-image", state: "running", health: "healthy", lastSeenAt: sampledAt },
      { id: stoppedId, name: "home-dashboard-migrate", image: "current-image", state: "exited", lastSeenAt: sampledAt },
      { id: unhealthyId, name: "other-service", image: "other-image", state: "running", health: "unhealthy", lastSeenAt: sampledAt },
    ] });
    await db.dockerMetric.create({ data: { containerId: oldId, sampledAt, cpuPercent: 25 } });

    await t.test("removed IDs disappear from lists, searches, state filters and summary counts", async () => {
      await markMissingDockerContainers(currentIds, sampledAt);
      const list = await listDockerContainers();
      assert.equal(list.total, 3);
      assert.deepEqual(new Set(list.items.map((item) => item.id)), new Set(currentIds));
      const search = await listDockerContainers(1, "HOME-DASHBOARD-WEB", "running");
      assert.equal(search.total, 1);
      assert.equal(search.items[0].id, currentId);
      assert.equal((await listDockerContainers(1, "previous-image")).total, 0);
      assert.equal((await listDockerContainers(1, "", "exited")).items[0].id, stoppedId);
      const status = await getDockerStatus();
      assert.deepEqual([status.total, status.running, status.unhealthy], [3, 2, 1]);
      assert.equal((await listDockerHistory(oldId, 24))[0].cpuPercent, 25);
    });

    await t.test("repeated polls preserve the first disappearance time for retention", async () => {
      await markMissingDockerContainers(currentIds, new Date(sampledAt.getTime() + 60_000));
      assert.deepEqual((await db.dockerContainer.findUniqueOrThrow({ where: { id: oldId } })).missingSince, sampledAt);
    });

    await t.test("a container observed again returns to the inventory", async () => {
      await saveDockerObservation({ container: {
        id: oldId, name: "returned-service", image: "previous-image", state: "exited", health: "none",
        createdAt: null, startedAt: null, finishedAt: null, exitCode: 0, restartCount: 0, composeProject: null, composeService: null,
      }, counters: null, metrics: null });
      assert.equal((await db.dockerContainer.findUniqueOrThrow({ where: { id: oldId } })).missingSince, null);
      assert.equal((await listDockerContainers(1, "returned-service")).total, 1);
      assert.equal((await getDockerStatus()).total, 4);
    });

    await t.test("an empty inventory hides all rows without deleting history", async () => {
      await markMissingDockerContainers([], new Date(sampledAt.getTime() + 120_000));
      assert.equal((await listDockerContainers()).total, 0);
      const status = await getDockerStatus();
      assert.deepEqual([status.total, status.running, status.unhealthy], [0, 0, 0]);
      assert.equal((await listDockerHistory(oldId, 24)).length, 1);
    });

    await t.test("old tombstones expire after 90 days even with ongoing polls", async () => {
      await db.dockerContainer.update({ where: { id: oldId }, data: { missingSince: new Date(Date.now() - 91 * 864e5) } });
      await markMissingDockerContainers([]);
      await pruneDockerMonitoring();
      assert.equal(await db.dockerContainer.findUnique({ where: { id: oldId } }), null);
      assert.equal(await db.dockerContainer.count(), 3);
    });
  } finally {
    await disconnectDatabase();
  }
});
