import type { FreelancehuntProject, FreelancehuntThread, FreelancehuntSkill } from "@home-dashboard/integrations";
import { uniqueNewProjects } from "@home-dashboard/integrations/freelancehunt-rules";
import { getDatabase } from "./client";
import { publishEventInTransaction, lockEventKey } from "./events";
import { projectNotificationRecipients } from "./freelancehunt-workspace";
import { createHash } from "node:crypto";

const settingsId = "default";
export const defaultFreelancehuntSkillIds = [103, 120, 121, 169, 175, 180, 183, 190, 24, 86];

export interface FreelancehuntSettingsInput {
  enabled: boolean;
  projectPollingEnabled: boolean;
  messagePollingEnabled: boolean;
  telegramEnabled: boolean;
  pollIntervalSeconds: number;
  skillIds: number[];
}

export interface StoredFreelancehuntProject extends FreelancehuntProject {
  discoveredAt: Date;
}

export interface StoredFreelancehuntThread extends FreelancehuntThread {
  discoveredAt: Date;
}

export interface FreelancehuntProjectPage {
  projects: StoredFreelancehuntProject[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getFreelancehuntSettings() {
  return getDatabase().freelancehuntSettings.upsert({
    where: { id: settingsId },
    create: { id: settingsId, skillIds: defaultFreelancehuntSkillIds },
    update: {},
  });
}

export async function updateFreelancehuntSettings(input: FreelancehuntSettingsInput) {
  return getDatabase().freelancehuntSettings.upsert({
    where: { id: settingsId },
    create: { id: settingsId, ...input },
    update: input,
  });
}

function projectEvent(project: FreelancehuntProject, recipientIds: string[]) {
  return JSON.stringify({ type: "freelancehunt.project.discovered", recipientIds, project: { id: project.id, name: project.name, url: project.url } });
}

function threadEvent(thread: FreelancehuntThread) {
  return JSON.stringify({ type: "freelancehunt.message.discovered", thread: { id: thread.id, subject: thread.subject, url: thread.url } });
}

export async function saveFreelancehuntProjects(projects: FreelancehuntProject[], baseline = false, checkpoint?: { page: number; baseline: boolean }): Promise<{ initial: boolean; projects: FreelancehuntProject[] }> {
  const db = getDatabase();
  return db.$transaction(async (transaction) => {
    await lockEventKey(transaction, "fh:project-sync");
    if (checkpoint) await saveScanInTransaction(transaction, "projects", checkpoint.page, checkpoint.baseline);
    const settings = await transaction.freelancehuntSettings.upsert({
      where: { id: settingsId },
      create: { id: settingsId, skillIds: defaultFreelancehuntSkillIds },
      update: {},
    });
    const ids = projects.map((project) => project.id);
    const existing = ids.length === 0 ? [] : await transaction.freelancehuntProject.findMany({
      where: { externalId: { in: ids } }, select: { externalId: true },
    });
    const known = new Set(existing.map((project) => project.externalId));
    const fresh = uniqueNewProjects(projects, known);
    const rows = [];
    for (const project of fresh) {
      const row = await transaction.freelancehuntProject.create({
        data: {
          externalId: project.id, name: project.name, description: project.description, url: project.url,
          budgetAmount: project.budgetAmount, budgetCurrency: project.budgetCurrency, skills: project.skills,
          publishedAt: project.publishedAt,
          skillIds: project.skillIds ?? [], categories: project.categories ?? [],
        },
      });
      rows.push({ project, row, recipients: await projectNotificationRecipients(transaction, row) });
    }
    if (!settings.projectsInitialized || baseline) {
      await transaction.freelancehuntSettings.update({ where: { id: settingsId }, data: { projectsInitialized: true } });
      return { initial: true, projects: [] };
    }
    for (const { project, recipients } of rows) {
      await publishEventInTransaction(transaction, { source: "freelancehunt", type: "freelancehunt.project_created", severity: "info", title: `Новий проєкт: ${project.name}`.slice(0, 500), payload: { externalId: project.id, name: project.name, url: project.url, budgetAmount: project.budgetAmount, budgetCurrency: project.budgetCurrency }, deduplicationKey: `fh:project:${project.id}`, telegram: settings.telegramEnabled, ...recipients });
      await transaction.$executeRaw`SELECT pg_notify('home_dashboard_events', ${projectEvent(project, recipients.userIds)})`;
    }
    return { initial: false, projects: fresh };
  }, { timeout: 60_000 });
}

// The catalogue supplies category groups and restores IDs on rows saved before this migration.
export async function syncFreelancehuntCatalogue(skills: FreelancehuntSkill[]) {
  if (!skills.length) return;
  const byName = new Map(skills.map((skill) => [skill.name.toLocaleLowerCase("uk"), skill]));
  const db = getDatabase();
  const catalogueVersion = createHash("sha256").update(JSON.stringify(skills)).digest("hex");
  const ready = await db.eventState.findUnique({ where: { key: "fh:catalogue-ready" } });
  const changed = ready?.value !== catalogueVersion;
  let cursor: bigint | undefined;
  while (true) {
    const last = await db.$transaction(async (tx) => {
      await lockEventKey(tx, "fh:catalogue-sync");
      let lastId: bigint | undefined;
      const rows = await tx.freelancehuntProject.findMany({ where: changed ? {} : { AND: [{ skills: { not: [] } }, { OR: [{ skillIds: { equals: [] } }, { categories: { equals: [] } }] }] }, orderBy: { id: "asc" }, take: 250, ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }) });
      if (!rows.length) return undefined;
      for (const row of rows) {
        const matched = (row.skills as string[]).flatMap((name) => { const skill = byName.get(name.toLocaleLowerCase("uk")); return skill ? [skill] : []; });
        const skillIds = [...new Set(matched.map((s) => s.id))], categories = [...new Set(matched.map((s) => s.groupName))];
        if (JSON.stringify(row.skillIds) === JSON.stringify(skillIds) && JSON.stringify(row.categories) === JSON.stringify(categories)) continue;
        await tx.freelancehuntProject.update({ where: { id: row.id }, data: { skillIds, categories } });
      }
      lastId = rows.at(-1)!.id;
      return lastId;
    }, { timeout: 15000 });
    if (last === undefined) break;
    cursor = last;
  }
  await db.eventState.upsert({ where: { key: "fh:catalogue-ready" }, create: { key: "fh:catalogue-ready", value: catalogueVersion }, update: { value: catalogueVersion } });
}

export async function freelancehuntScan(kind: "projects" | "threads", initialized: boolean) {
  const row = await getDatabase().eventState.findUnique({ where: { key: `fh:scan:${kind}` } });
  const [page, baseline] = (row?.value ?? "1:0").split(":");
  return { page: Math.min(10000, Math.max(1, Number(page) || 1)), baseline: !initialized || baseline === "1" };
}
export async function saveFreelancehuntScan(kind: "projects" | "threads", page: number, baseline: boolean) {
  return getDatabase().$transaction(tx => saveScanInTransaction(tx, kind, page, baseline));
}
async function saveScanInTransaction(tx: import("./events").EventTransaction, kind: "projects" | "threads", page: number, baseline: boolean) {
  const key = `fh:scan:${kind}`, value = `${page}:${baseline ? 1 : 0}`;
  await tx.eventState.upsert({ where: { key }, create: { key, value }, update: { value } });
}
export async function knownFreelancehuntProjects(ids: number[]) {
  return getDatabase().freelancehuntProject.count({ where: { externalId: { in: ids } } });
}

export async function saveFreelancehuntThreads(threads: FreelancehuntThread[], baseline = false, checkpoint?: { page: number; baseline: boolean }): Promise<{ initial: boolean; threads: FreelancehuntThread[] }> {
  const db = getDatabase();
  return db.$transaction(async (transaction) => {
    await lockEventKey(transaction, "fh:thread-sync");
    if (checkpoint) await saveScanInTransaction(transaction, "threads", checkpoint.page, checkpoint.baseline);
    const settings = await transaction.freelancehuntSettings.upsert({
      where: { id: settingsId },
      create: { id: settingsId, skillIds: defaultFreelancehuntSkillIds },
      update: {},
    });
    const ids = threads.map((thread) => thread.id);
    const existing = ids.length === 0 ? [] : await transaction.freelancehuntThread.findMany({
      where: { externalId: { in: ids } },
      select: { externalId: true, messagesCount: true, lastPostedAt: true },
    });
    const known = new Map(existing.map((thread) => [thread.externalId, thread]));
    const fresh: FreelancehuntThread[] = [];
    for (const thread of threads) {
      const previous = known.get(thread.id);
      const changed = thread.isUnread && (!previous || (
        thread.messagesCount > previous.messagesCount ||
        (thread.lastPostedAt !== null && previous.lastPostedAt?.getTime() !== thread.lastPostedAt.getTime())
      ));
      if (changed) fresh.push(thread);
      await transaction.freelancehuntThread.upsert({
        where: { externalId: thread.id },
        create: {
          externalId: thread.id, subject: thread.subject, url: thread.url, lastPostedAt: thread.lastPostedAt,
          messagesCount: thread.messagesCount, isUnread: thread.isUnread,
        },
        update: {
          subject: thread.subject, url: thread.url, lastPostedAt: thread.lastPostedAt,
          messagesCount: thread.messagesCount, isUnread: thread.isUnread,
        },
      });
    }
    if (!settings.messagesInitialized || baseline) {
      await transaction.freelancehuntSettings.update({ where: { id: settingsId }, data: { messagesInitialized: true } });
      return { initial: true, threads: [] };
    }
    for (const thread of fresh) {
      await publishEventInTransaction(transaction, { source: "freelancehunt", type: "freelancehunt.message_received", severity: "info", title: `Нове повідомлення: ${thread.subject}`.slice(0, 500), payload: { externalId: thread.id, subject: thread.subject, url: thread.url }, deduplicationKey: `fh:thread:${thread.id}:${thread.messagesCount}:${thread.lastPostedAt?.getTime() ?? 0}`, telegram: settings.telegramEnabled });
      await transaction.$executeRaw`SELECT pg_notify('home_dashboard_events', ${threadEvent(thread)})`;
    }
    return { initial: false, threads: fresh };
  });
}

export async function listRecentFreelancehuntProjects(limit = 20): Promise<StoredFreelancehuntProject[]> {
  const rows = await getDatabase().freelancehuntProject.findMany({ orderBy: { discoveredAt: "desc" }, take: limit });
  return rows.map((row) => ({
    id: row.externalId, name: row.name, description: row.description, url: row.url,
    budgetAmount: row.budgetAmount, budgetCurrency: row.budgetCurrency,
    skills: row.skills as string[], publishedAt: row.publishedAt, discoveredAt: row.discoveredAt,
  }));
}

export async function listFreelancehuntProjects(page = 1, pageSize = 12): Promise<FreelancehuntProjectPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const db = getDatabase();
  const [rows, total] = await Promise.all([
    db.freelancehuntProject.findMany({ orderBy: { discoveredAt: "desc" }, skip: (safePage - 1) * safePageSize, take: safePageSize }),
    db.freelancehuntProject.count(),
  ]);
  return {
    projects: rows.map((row) => ({
      id: row.externalId, name: row.name, description: row.description, url: row.url,
      budgetAmount: row.budgetAmount, budgetCurrency: row.budgetCurrency,
      skills: row.skills as string[], publishedAt: row.publishedAt, discoveredAt: row.discoveredAt,
    })), total, page: safePage, pageSize: safePageSize,
  };
}
