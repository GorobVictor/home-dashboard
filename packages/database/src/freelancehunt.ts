import type { FreelancehuntProject, FreelancehuntThread } from "@home-dashboard/integrations";
import { getDatabase } from "./client";
import { publishEventInTransaction } from "./events";

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

function projectEvent(project: FreelancehuntProject) {
  return JSON.stringify({ type: "freelancehunt.project.discovered", project: { id: project.id, name: project.name, url: project.url } });
}

function threadEvent(thread: FreelancehuntThread) {
  return JSON.stringify({ type: "freelancehunt.message.discovered", thread: { id: thread.id, subject: thread.subject, url: thread.url } });
}

export async function saveFreelancehuntProjects(projects: FreelancehuntProject[]): Promise<{ initial: boolean; projects: FreelancehuntProject[] }> {
  const db = getDatabase();
  return db.$transaction(async (transaction) => {
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
    const fresh = projects.filter((project) => !known.has(project.id));
    for (const project of fresh) {
      await transaction.freelancehuntProject.create({
        data: {
          externalId: project.id, name: project.name, description: project.description, url: project.url,
          budgetAmount: project.budgetAmount, budgetCurrency: project.budgetCurrency, skills: project.skills,
          publishedAt: project.publishedAt,
        },
      });
    }
    if (!settings.projectsInitialized) {
      await transaction.freelancehuntSettings.update({ where: { id: settingsId }, data: { projectsInitialized: true } });
      return { initial: true, projects: [] };
    }
    for (const project of fresh) {
      await publishEventInTransaction(transaction, { source: "freelancehunt", type: "freelancehunt.project_created", severity: "info", title: `Новий проєкт: ${project.name}`.slice(0, 500), payload: { externalId: project.id, name: project.name, url: project.url, budgetAmount: project.budgetAmount, budgetCurrency: project.budgetCurrency }, deduplicationKey: `fh:project:${project.id}`, telegram: settings.telegramEnabled });
      await transaction.$executeRaw`SELECT pg_notify('home_dashboard_events', ${projectEvent(project)})`;
    }
    return { initial: false, projects: fresh };
  });
}

export async function saveFreelancehuntThreads(threads: FreelancehuntThread[]): Promise<{ initial: boolean; threads: FreelancehuntThread[] }> {
  const db = getDatabase();
  return db.$transaction(async (transaction) => {
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
    if (!settings.messagesInitialized) {
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
