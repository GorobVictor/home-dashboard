import type { Prisma } from "../generated/client/client";
import type { FreelancehuntProject } from "@home-dashboard/integrations";
import { emptyProjectFilters, initialScoringProfiles, parseProjectFilters, parseScoringProfile, scoreProject, projectStateChanges, type ProjectFilters, type ScoringProfile, type ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { getDatabase } from "./client";
import { lockEventKey, notifyChanged, type EventTransaction } from "./events";

type ProjectRow = Prisma.FreelancehuntProjectGetPayload<object>;
const json = (value: object) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const mapFreelancehuntProject = (row: ProjectRow): FreelancehuntProject & { discoveredAt: Date } => ({ id: row.externalId, name: row.name, description: row.description, url: row.url, budgetAmount: row.budgetAmount, budgetCurrency: row.budgetCurrency, skills: row.skills as string[], skillIds: row.skillIds as number[], categories: row.categories as string[], publishedAt: row.publishedAt, discoveredAt: row.discoveredAt });

export async function ensureFreelancehuntPreferences(tx: EventTransaction, userId: string) {
  return tx.freelancehuntPreferences.upsert({ where: { userId }, create: { userId, filters: json(emptyProjectFilters), scoring: json(initialScoringProfiles[0].profile) }, update: {} });
}

// Cursor batches bound memory. Replacing only score fields preserves all personal actions.
async function refreshScores(tx: EventTransaction, userId: string, profile: ScoringProfile, missingOnly: boolean) {
  let cursor: bigint | undefined;
  while (true) {
    const rows = await tx.freelancehuntProject.findMany({ where: missingOnly ? { states: { none: { userId } } } : {}, orderBy: { id: "asc" }, take: 250, ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }) });
    if (!rows.length) break;
    for (const row of rows) {
      const result = scoreProject(mapFreelancehuntProject(row), profile), data = { score: result.score, reasons: json(result.reasons) };
      await tx.freelancehuntProjectState.upsert({ where: { userId_projectId: { userId, projectId: row.id } }, create: { userId, projectId: row.id, ...data }, update: data });
    }
    cursor = rows.at(-1)!.id;
  }
}

export async function getFreelancehuntWorkspace(userId: string) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:profile:${userId}`);
    const preferences = await ensureFreelancehuntPreferences(tx, userId);
    const scoring = parseScoringProfile(preferences.scoring);
    await refreshScores(tx, userId, scoring, true);
    const presets = await tx.freelancehuntPreset.findMany({ where: { userId }, orderBy: { name: "asc" } });
    const catalogue = await tx.eventState.findUnique({ where: { key: "fh:catalogue-ready" } });
    return { filters: parseProjectFilters(preferences.filters), scoring, notificationMinScore: preferences.notificationMinScore, presets: presets.map((p) => ({ id: p.id, name: p.name, filters: parseProjectFilters(p.filters), scoring: parseScoringProfile(p.scoring) })), catalogueReady: !!catalogue };
  }, { timeout: 60_000 });
}

export async function updateFreelancehuntWorkspace(userId: string, input: { filters?: ProjectFilters; scoring?: ScoringProfile; notificationMinScore?: number }) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:profile:${userId}`);
    await ensureFreelancehuntPreferences(tx, userId);
    await tx.freelancehuntPreferences.update({ where: { userId }, data: { ...(input.filters ? { filters: json(input.filters) } : {}), ...(input.scoring ? { scoring: json(input.scoring) } : {}), ...(input.notificationMinScore === undefined ? {} : { notificationMinScore: input.notificationMinScore }) } });
    if (input.scoring) await refreshScores(tx, userId, input.scoring, false);
    await notifyChanged(tx);
    return { ok: true };
  }, { timeout: 60_000 });
}

export async function saveFreelancehuntPreset(userId: string, name: string, filters: ProjectFilters, scoring: ScoringProfile) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:profile:${userId}`);
    if (await tx.freelancehuntPreset.count({ where: { userId } }) >= 30 && !await tx.freelancehuntPreset.findUnique({ where: { userId_name: { userId, name } } })) throw new Error("preset_limit");
    const data = { filters: json(filters), scoring: json(scoring) };
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
  const where: Prisma.FreelancehuntProjectStateWhereInput = { userId, score: { gte: filters.minScore, lte: filters.maxScore }, project: projectFilterWhere(filters), ...(filters.state === "hidden" ? { hiddenAt: { not: null } } : { hiddenAt: null }), ...(filters.state === "new" ? { viewedAt: null } : filters.state === "viewed" ? { viewedAt: { not: null } } : filters.state === "saved" ? { savedAt: { not: null } } : {}) };
  const orderBy: Prisma.FreelancehuntProjectStateOrderByWithRelationInput[] = filters.sort === "relevance" ? [{ score: "desc" }] : filters.sort === "budget" ? [{ project: { budgetCurrency: { sort: "asc", nulls: "last" } } }, { project: { budgetAmount: { sort: "desc", nulls: "last" } } }] : [];
  orderBy.push({ project: { publishedAt: { sort: "desc", nulls: "last" } } }, { projectId: "desc" });
  const db = getDatabase();
  const [rows, total] = await Promise.all([db.freelancehuntProjectState.findMany({ where, include: { project: true }, orderBy, skip: (safePage - 1) * pageSize, take: pageSize }), db.freelancehuntProjectState.count({ where })]);
  return { projects: rows.map((row) => ({ ...mapFreelancehuntProject(row.project), score: row.score, reasons: row.reasons, saved: !!row.savedAt, hidden: !!row.hiddenAt, viewed: !!row.viewedAt, notes: row.notes })), total, page: safePage, pageSize };
}

export async function getStoredFreelancehuntProject(externalId: number) {
  const row = await getDatabase().freelancehuntProject.findUnique({ where: { externalId } });
  return row ? mapFreelancehuntProject(row) : null;
}
export async function updateFreelancehuntProjectState(userId: string, externalId: number, patch: ProjectStatePatch) {
  return getDatabase().$transaction(async (tx) => {
    await lockEventKey(tx, `fh:profile:${userId}`);
    const row = await tx.freelancehuntProject.findUniqueOrThrow({ where: { externalId } });
    const prefs = await ensureFreelancehuntPreferences(tx, userId), result = scoreProject(mapFreelancehuntProject(row), parseScoringProfile(prefs.scoring));
    await tx.freelancehuntProjectState.upsert({ where: { userId_projectId: { userId, projectId: row.id } }, create: { userId, projectId: row.id, score: result.score, reasons: json(result.reasons), ...projectStateChanges(patch) }, update: projectStateChanges(patch) });
    await notifyChanged(tx);
    return { ok: true };
  });
}

export async function scoreNewProject(tx: EventTransaction, row: ProjectRow) {
  const users = await tx.user.findMany({ select: { id: true } }), recipients: string[] = [];
  for (const user of users) {
    await lockEventKey(tx, `fh:profile:${user.id}`);
    const prefs = await ensureFreelancehuntPreferences(tx, user.id), result = scoreProject(mapFreelancehuntProject(row), parseScoringProfile(prefs.scoring));
    await tx.freelancehuntProjectState.upsert({ where: { userId_projectId: { userId: user.id, projectId: row.id } }, create: { userId: user.id, projectId: row.id, score: result.score, reasons: json(result.reasons) }, update: { score: result.score, reasons: json(result.reasons) } });
    if (result.score >= prefs.notificationMinScore) recipients.push(user.id);
  }
  const channels = await tx.notificationChannel.findMany({ where: { enabled: true } });
  return { userIds: recipients, channelIds: channels.filter((channel) => scoreProject(mapFreelancehuntProject(row), channel.projectScoring ? parseScoringProfile(channel.projectScoring) : initialScoringProfiles[0].profile).score >= channel.projectMinScore).map((c) => c.id) };
}
