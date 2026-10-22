import type { Prisma } from "../generated/client/client";
import type { FreelancehuntProject } from "@home-dashboard/integrations";
import { emptyProjectFilters, parseProjectFilters, projectStateChanges, type ProjectFilters, type ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { getDatabase } from "./client";
import { lockEventKey, notifyChanged, type EventTransaction } from "./events";

type ProjectRow = Prisma.FreelancehuntProjectGetPayload<object>;
const json = (value: object) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const mapFreelancehuntProject = (row: ProjectRow): FreelancehuntProject & { discoveredAt: Date } => ({ id: row.externalId, name: row.name, description: row.description, url: row.url, budgetAmount: row.budgetAmount, budgetCurrency: row.budgetCurrency, skills: row.skills as string[], skillIds: row.skillIds as number[], categories: row.categories as string[], publishedAt: row.publishedAt, discoveredAt: row.discoveredAt });

export async function ensureFreelancehuntPreferences(tx: EventTransaction, userId: string) {
  return tx.freelancehuntPreferences.upsert({ where: { userId }, create: { userId, filters: json(emptyProjectFilters) }, update: {} });
}

export async function getFreelancehuntWorkspace(userId: string) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:preferences:${userId}`);
    const preferences = await ensureFreelancehuntPreferences(tx, userId);
    const presets = await tx.freelancehuntPreset.findMany({ where: { userId }, orderBy: { name: "asc" } });
    const catalogue = await tx.eventState.findUnique({ where: { key: "fh:catalogue-ready" } });
    return { filters: parseProjectFilters(preferences.filters), presets: presets.map((p) => ({ id: p.id, name: p.name, filters: parseProjectFilters(p.filters) })), catalogueReady: !!catalogue };
  }, { timeout: 60_000 });
}

export async function updateFreelancehuntWorkspace(userId: string, input: { filters: ProjectFilters }) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:preferences:${userId}`);
    await ensureFreelancehuntPreferences(tx, userId);
    await tx.freelancehuntPreferences.update({ where: { userId }, data: { filters: json(input.filters) } });
    await notifyChanged(tx);
    return { ok: true };
  }, { timeout: 60_000 });
}

export async function saveFreelancehuntPreset(userId: string, name: string, filters: ProjectFilters) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:preferences:${userId}`);
    if (await tx.freelancehuntPreset.count({ where: { userId } }) >= 30 && !await tx.freelancehuntPreset.findUnique({ where: { userId_name: { userId, name } } })) throw new Error("preset_limit");
    const data = { filters: json(filters) };
    const preset = await tx.freelancehuntPreset.upsert({ where: { userId_name: { userId, name } }, create: { userId, name, ...data }, update: data });
    return { id: preset.id, name: preset.name };
  });
}
export async function deleteFreelancehuntPreset(userId: string, id: string) {
  return getDatabase().freelancehuntPreset.deleteMany({ where: { userId, id } });
}

export function projectFilterWhere(filters: ProjectFilters): Prisma.FreelancehuntProjectWhereInput {
  const and: Prisma.FreelancehuntProjectWhereInput[] = [];
  if (filters.minBudget !== null || filters.maxBudget !== null) and.push({ budgetAmount: { ...(filters.minBudget === null ? {} : { gte: filters.minBudget }), ...(filters.maxBudget === null ? {} : { lte: filters.maxBudget }) } });
  if (filters.currency) and.push({ budgetCurrency: filters.currency });
  if (filters.skillIds.length) and.push({ OR: filters.skillIds.map((id) => ({ skillIds: { array_contains: [id] } })) });
  if (filters.categories.length) and.push({ OR: filters.categories.map((category) => ({ categories: { array_contains: [category] } })) });
  // Escape LIKE metacharacters so user keywords are always literal strings.
  const literal = (term: string) => term.replace(/[\\%_]/g, "\\$&");
  for (const term of filters.include) and.push({ OR: [{ name: { contains: literal(term), mode: "insensitive" } }, { description: { contains: literal(term), mode: "insensitive" } }] });
  for (const term of filters.exclude) and.push({ AND: [{ name: { mode: "insensitive", not: { contains: literal(term) } } }, { OR: [{ description: null }, { description: { mode: "insensitive", not: { contains: literal(term) } } }] }] });
  if (filters.from || filters.to) and.push({ publishedAt: { ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}), ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}) } });
  return { AND: and };
}

export async function listPersonalFreelancehuntProjects(userId: string, filters: ProjectFilters, page = 1) {
  const safePage = Math.min(10000, Math.max(1, Math.floor(page) || 1)), pageSize = 12;
  const state = (condition: Prisma.FreelancehuntProjectStateWhereInput) => ({ userId, ...condition });
  const where: Prisma.FreelancehuntProjectWhereInput = { AND: [projectFilterWhere(filters),
    filters.state === "hidden" ? { states: { some: state({ hiddenAt: { not: null } }) } } : { states: { none: state({ hiddenAt: { not: null } }) } },
    ...(filters.state === "new" ? [{ states: { none: state({ viewedAt: { not: null } }) } }] : []),
    ...(filters.state === "viewed" ? [{ states: { some: state({ viewedAt: { not: null } }) } }] : []),
    ...(filters.state === "saved" ? [{ states: { some: state({ savedAt: { not: null } }) } }] : []),
  ] };
  const orderBy: Prisma.FreelancehuntProjectOrderByWithRelationInput[] = filters.sort === "budget" ? [{ budgetCurrency: { sort: "asc", nulls: "last" } }, { budgetAmount: { sort: "desc", nulls: "last" } }] : [];
  orderBy.push({ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" });
  const db = getDatabase();
  const [rows, total] = await Promise.all([db.freelancehuntProject.findMany({ where, include: { states: { where: { userId } } }, orderBy, skip: (safePage - 1) * pageSize, take: pageSize }), db.freelancehuntProject.count({ where })]);
  return { projects: rows.map((row) => {
    const personal = row.states[0];
    return { ...mapFreelancehuntProject(row), saved: !!personal?.savedAt, hidden: !!personal?.hiddenAt, viewed: !!personal?.viewedAt, notes: personal?.notes ?? "" };
  }), total, page: safePage, pageSize };
}

export async function getStoredFreelancehuntProject(externalId: number) {
  const row = await getDatabase().freelancehuntProject.findUnique({ where: { externalId } });
  return row ? mapFreelancehuntProject(row) : null;
}
export async function updateFreelancehuntProjectState(userId: string, externalId: number, patch: ProjectStatePatch) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:preferences:${userId}`);
    const row = await tx.freelancehuntProject.findUniqueOrThrow({ where: { externalId } });
    await tx.freelancehuntProjectState.upsert({ where: { userId_projectId: { userId, projectId: row.id } }, create: { userId, projectId: row.id, ...projectStateChanges(patch) }, update: projectStateChanges(patch) });
    await notifyChanged(tx);
    return { ok: true };
  });
}

// Content filters select future inbox/toast recipients. Personal saved/viewed/hidden
// state affects the list only; it must not suppress newly discovered projects.
export async function projectNotificationRecipients(tx: EventTransaction, row: ProjectRow) {
  const users = await tx.user.findMany({ select: { id: true, freelancehuntPreferences: { select: { filters: true } } } });
  const userIds: string[] = [];
  for (const user of users) {
    const filters = user.freelancehuntPreferences ? parseProjectFilters(user.freelancehuntPreferences.filters) : emptyProjectFilters;
    if (await tx.freelancehuntProject.count({ where: { AND: [{ id: row.id }, projectFilterWhere(filters)] } })) userIds.push(user.id);
  }
  return { userIds };
}
