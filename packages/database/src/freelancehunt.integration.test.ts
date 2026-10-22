import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabase, disconnectDatabase } from "./client";
import { saveFreelancehuntProjects, syncFreelancehuntCatalogue } from "./freelancehunt";
import { getFreelancehuntWorkspace, updateFreelancehuntWorkspace, listPersonalFreelancehuntProjects, updateFreelancehuntProjectState, saveFreelancehuntPreset, deleteFreelancehuntPreset, getStoredFreelancehuntProject } from "./freelancehunt-workspace";
import { saveNotificationChannel } from "./notifications";
import { emptyProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
import type { FreelancehuntProject } from "@home-dashboard/integrations";

const testUrl = process.env.FREELANCEHUNT_TEST_DATABASE_URL;
test("Freelancehunt PostgreSQL workspace, filtering and notification deduplication", { skip: !testUrl }, async (t) => {
  assert.match(new URL(testUrl!).pathname, /_freelancehunt_test$/);
  process.env.DATABASE_URL = testUrl;
  const db = getDatabase();
  const user = await db.user.create({ data: { firstName: "FH", lastName: "Test", login: "fh-test", passwordHash: "unused" } });
  const other = await db.user.create({ data: { firstName: "Other", lastName: "Test", login: "fh-other", passwordHash: "unused" } });
  const sample = (id: number, overrides: Partial<FreelancehuntProject> = {}): FreelancehuntProject => ({ id, name: "C# Backend", description: null, url: `https://freelancehunt.com/project/${id}.html`, budgetAmount: 5000, budgetCurrency: "UAH", skills: ["C#"], skillIds: [24], categories: ["Programming"], publishedAt: new Date("2026-10-16T12:00:00Z"), ...overrides });
  try {
    await updateFreelancehuntWorkspace(user.id, { filters: { ...emptyProjectFilters, include: ["C#"] } });
    await updateFreelancehuntWorkspace(other.id, { filters: { ...emptyProjectFilters, include: ["missing"] } });
    const channel = await saveNotificationChannel({ name: "Project feed", chatId: "-12345", enabled: true, minSeverity: "info", sources: ["freelancehunt"] });
    await t.test("baseline is silent, repeated and concurrent synchronizations create one event per new ID", async () => {
      assert.equal((await saveFreelancehuntProjects([sample(100), sample(100)])).initial, true);
      assert.equal(await db.event.count(), 0);
      const results = await Promise.all([saveFreelancehuntProjects([sample(101), sample(101), sample(102, { name: "Design", skills: [], skillIds: [], categories: [], budgetAmount: null })]), saveFreelancehuntProjects([sample(101)])]);
      assert.equal(results.reduce((sum, r) => sum + r.projects.length, 0), 2);
      assert.equal(await db.freelancehuntProject.count(), 3);
      assert.equal(await db.event.count({ where: { type: "freelancehunt.project_created" } }), 2);
      assert.equal(await db.notification.count({ where: { userId: user.id } }), 1);
      assert.equal(await db.notification.count({ where: { userId: other.id } }), 0);
      assert.equal(await db.notification.count({ where: { channelId: channel.id } }), 2);
      await saveFreelancehuntProjects([sample(101)]);
      assert.equal(await db.notification.count(), 3);
    });
    await t.test("users see historical and new projects without materialized personal rows", async () => {
      assert.equal(await db.freelancehuntProjectState.count(), 0);
      assert.equal((await listPersonalFreelancehuntProjects(user.id, emptyProjectFilters)).total, 3);
      assert.equal((await listPersonalFreelancehuntProjects(other.id, { ...emptyProjectFilters, state: "new" })).total, 3);
      assert.equal((await listPersonalFreelancehuntProjects(other.id, { ...emptyProjectFilters, state: "viewed" })).total, 0);
    });
    await t.test("save, unsave, notes, viewed and hidden state belong to each user and survive restart", async () => {
      await updateFreelancehuntProjectState(user.id, 101, { saved: true, viewed: true, notes: "Private note" });
      let page = await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, state: "saved" });
      assert.equal(page.total, 1); assert.equal(page.projects[0].notes, "Private note");
      assert.equal((await listPersonalFreelancehuntProjects(other.id, { ...emptyProjectFilters, state: "saved" })).total, 0);
      assert.equal((await listPersonalFreelancehuntProjects(other.id, emptyProjectFilters)).projects.find((p) => p.id === 101)?.notes, "");
      await updateFreelancehuntProjectState(user.id, 101, { hidden: true });
      assert.equal((await listPersonalFreelancehuntProjects(user.id, emptyProjectFilters)).total, 2);
      assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, state: "hidden" })).total, 1);
      await updateFreelancehuntProjectState(user.id, 101, { hidden: false, saved: false });
      await disconnectDatabase();
      page = await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, state: "viewed" });
      assert.equal(page.projects[0].saved, false); assert.equal(page.projects[0].notes, "Private note");
      assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, state: "new" })).total, 2);
    });
    await t.test("server-side filters combine budget, currency, skills, categories, keywords, dates", async () => {
      const filters = { ...emptyProjectFilters, minBudget: 5000, maxBudget: 5000, currency: "UAH", skillIds: [24], categories: ["Programming"], include: ["backend"], exclude: ["wordpress"], from: "2026-10-16", to: "2026-10-16" };
      assert.equal((await listPersonalFreelancehuntProjects(user.id, filters)).total, 2);
      for (const change of [{ currency: "USD" }, { skillIds: [999] }, { categories: ["Design"] }, { include: ["missing"] }, { exclude: ["C#"] }, { from: "2026-10-17", to: "2026-10-18" }]) assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...filters, ...change })).total, 0);
      // Missing descriptions must not disappear when an excluded word is absent.
      assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, exclude: ["wordpress"] })).total, 3);
      await saveFreelancehuntProjects([sample(103, { name: "C# 100%_done", budgetAmount: 9000 }), sample(104, { name: "C# 100percent_done", budgetAmount: 100 })]);
      assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, include: ["100%_"] })).total, 1);
      const byBudget = await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, sort: "budget" });
      assert.equal(byBudget.projects[0].id, 103); assert.equal(byBudget.projects.at(-1)?.budgetAmount, null);
    });
    await t.test("presets, filters and personal actions persist without duplicating per-user projects", async () => {
      const filters = { ...emptyProjectFilters, state: "saved" as const };
      await updateFreelancehuntWorkspace(user.id, { filters });
      const workspace = await getFreelancehuntWorkspace(user.id);
      assert.deepEqual(workspace.filters, filters);
      const page = await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, state: "viewed" });
      assert.equal(page.projects[0].notes, "Private note");
      const preset = await saveFreelancehuntPreset(user.id, "Backend", filters);
      await saveFreelancehuntPreset(user.id, "Other", emptyProjectFilters);
      await saveFreelancehuntPreset(user.id, "Backend", emptyProjectFilters);
      await deleteFreelancehuntPreset(other.id, preset.id);
      await disconnectDatabase();
      assert.equal((await getFreelancehuntWorkspace(user.id)).presets.length, 2);
      assert.equal((await getFreelancehuntWorkspace(other.id)).presets.length, 0);
      await deleteFreelancehuntPreset(user.id, preset.id);
      assert.equal((await getFreelancehuntWorkspace(user.id)).presets.length, 1);
    });
    await t.test("catalogue backfill restores numeric skills and categories without rediscovery events", async () => {
      const count = await getDatabase().event.count();
      await syncFreelancehuntCatalogue([{ id: 24, name: "C#", groupName: "Software development" }]);
      assert.deepEqual((await getStoredFreelancehuntProject(100))?.categories, ["Software development"]);
      assert.equal(await getDatabase().event.count(), count);
      assert.equal((await listPersonalFreelancehuntProjects(user.id, { ...emptyProjectFilters, categories: ["Software development"] })).total, 4);
    });
  } finally { await disconnectDatabase(); }
});
