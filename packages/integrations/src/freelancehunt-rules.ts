// Pure domain rules shared by repositories, filters and tests.
export interface ProjectFilters {
  minBudget: number | null; maxBudget: number | null; currency: string;
  skillIds: number[]; categories: string[]; include: string[]; exclude: string[];
  from: string; to: string;
  state: "all" | "new" | "viewed" | "saved" | "hidden";
  sort: "date" | "budget";
}
export const emptyProjectFilters: ProjectFilters = { minBudget: null, maxBudget: null, currency: "", skillIds: [], categories: [], include: [], exclude: [], from: "", to: "", state: "all", sort: "date" };

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_input");
  return value as Record<string, unknown>;
}
function bounded(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error("invalid_input");
  return value;
}
function strings(value: unknown, limit = 30): string[] {
  if (!Array.isArray(value) || value.length > limit || value.some((v) => typeof v !== "string" || !v.trim() || v.length > 100)) throw new Error("invalid_input");
  return [...new Set((value as string[]).map((v) => v.trim()))];
}
export function parseProjectFilters(value: unknown): ProjectFilters {
  const supplied = record(value);
  if (Object.keys(supplied).some((key) => !Object.hasOwn(emptyProjectFilters, key))) throw new Error("invalid_input");
  const input = { ...emptyProjectFilters, ...supplied };
  const minBudget = input.minBudget === null ? null : bounded(input.minBudget, 0, 1e12);
  const maxBudget = input.maxBudget === null ? null : bounded(input.maxBudget, 0, 1e12);
  if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) throw new Error("invalid_input");
  if (typeof input.currency !== "string" || !/^([A-Z]{3})?$/.test(input.currency) || !Array.isArray(input.skillIds) || input.skillIds.length > 50 || input.skillIds.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 1e6)) throw new Error("invalid_input");
  for (const date of [input.from, input.to]) if (typeof date !== "string" || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) throw new Error("invalid_input");
  if (input.from && input.to && input.from > input.to) throw new Error("invalid_input");
  if (!["all", "new", "viewed", "saved", "hidden"].includes(input.state) || !["date", "budget"].includes(input.sort)) throw new Error("invalid_input");
  return { minBudget, maxBudget, currency: input.currency, skillIds: [...new Set(input.skillIds)], categories: strings(input.categories), include: strings(input.include), exclude: strings(input.exclude), from: input.from, to: input.to, state: input.state, sort: input.sort };
}
export interface ProjectStatePatch { saved?: boolean; hidden?: boolean; viewed?: true; notes?: string }
export function parseProjectStatePatch(value: unknown): ProjectStatePatch {
  const input = record(value);
  if (!Object.keys(input).length || Object.keys(input).some((key) => !["saved", "hidden", "viewed", "notes"].includes(key)) || ["saved", "hidden"].some((key) => key in input && typeof input[key] !== "boolean") || ("viewed" in input && input.viewed !== true) || ("notes" in input && (typeof input.notes !== "string" || input.notes.length > 3000))) throw new Error("invalid_input");
  return input as ProjectStatePatch;
}
export function projectStateChanges(patch: ProjectStatePatch, now = new Date()) {
  return { ...(patch.saved === undefined ? {} : { savedAt: patch.saved ? now : null }), ...(patch.hidden === undefined ? {} : { hiddenAt: patch.hidden ? now : null }), ...(patch.viewed ? { viewedAt: now } : {}), ...(patch.notes === undefined ? {} : { notes: patch.notes }) };
}
export function uniqueNewProjects<T extends { id: number }>(projects: T[], known: Set<number>): T[] {
  const seen = new Set(known);
  return projects.filter((project) => { if (seen.has(project.id)) return false; seen.add(project.id); return true; });
}
