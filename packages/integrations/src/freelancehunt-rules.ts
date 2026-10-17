// Pure domain rules shared by repositories, tests and the profile editor.
export interface ScoringRule {
  field: "technology" | "title" | "description" | "keyword" | "category" | "budget";
  term: string;
  weight: number;
  minimum?: number;
  maximum?: number;
  currency?: string;
}
export interface ScoringProfile { base: number; rules: ScoringRule[] }
export interface ScoreReason { rule: string; weight: number }
export interface ScorableProject {
  name: string; description: string | null; skills: string[]; categories?: string[];
  budgetAmount: number | null; budgetCurrency: string | null;
}
export interface ProjectFilters {
  minBudget: number | null; maxBudget: number | null; currency: string;
  skillIds: number[]; categories: string[]; include: string[]; exclude: string[];
  from: string; to: string; minScore: number; maxScore: number;
  state: "all" | "new" | "viewed" | "saved" | "hidden";
  sort: "date" | "relevance" | "budget";
}
export const emptyProjectFilters: ProjectFilters = { minBudget: null, maxBudget: null, currency: "", skillIds: [], categories: [], include: [], exclude: [], from: "", to: "", minScore: 0, maxScore: 100, state: "all", sort: "date" };

// Seed data only: the algorithm below has no technology or user preferences.
export const initialScoringProfiles: { name: string; profile: ScoringProfile }[] = [
  { name: ".NET / Backend", profile: { base: 20, rules: [
    ...["C#", ".NET", "ASP.NET Core"].map((term) => ({ field: "technology" as const, term, weight: 20 })),
    ...["PostgreSQL", "MSSQL", "Azure", "AWS", "Docker"].map((term) => ({ field: "technology" as const, term, weight: 8 })),
    ...["REST API", "backend", "integration", "інтеграці"].map((term) => ({ field: "keyword" as const, term, weight: 10 })),
  ] } },
  { name: "Backend / Integrations", profile: { base: 20, rules: [
    ...["REST", "API", "backend", "integration", "інтеграці"].map((term) => ({ field: "keyword" as const, term, weight: 15 })),
    ...["PostgreSQL", "MSSQL", "Azure", "AWS", "Docker", "C#", ".NET", "ASP.NET Core"].map((term) => ({ field: "technology" as const, term, weight: 10 })),
  ] } },
];
const normalize = (text: string) => text.toLocaleLowerCase("uk");
export const containsKeyword = (text: string, term: string) => normalize(text).includes(normalize(term));
function technologyMatch(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}
export function scoreProject(project: ScorableProject, profile: ScoringProfile) {
  const reasons: ScoreReason[] = [{ rule: "Базова оцінка", weight: profile.base }];
  const text = `${project.name}\n${project.description ?? ""}`;
  for (const rule of profile.rules) {
    const match = rule.field === "budget" ? project.budgetAmount !== null && project.budgetCurrency === rule.currency && (rule.minimum === undefined || project.budgetAmount >= rule.minimum) && (rule.maximum === undefined || project.budgetAmount <= rule.maximum)
      : rule.field === "category" ? (project.categories ?? []).some((c) => normalize(c) === normalize(rule.term))
      : rule.field === "technology" ? technologyMatch(`${text}\n${project.skills.join("\n")}`, rule.term)
      : containsKeyword(rule.field === "title" ? project.name : rule.field === "description" ? project.description ?? "" : text, rule.term);
    if (match) reasons.push({ rule: `${rule.field}: ${rule.field === "budget" ? `${rule.minimum ?? 0}–${rule.maximum ?? "∞"} ${rule.currency}` : rule.term}`, weight: rule.weight });
  }
  return { score: Math.max(0, Math.min(100, reasons.reduce((sum, reason) => sum + reason.weight, 0))), reasons };
}
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
export function parseScoringProfile(value: unknown): ScoringProfile {
  const input = record(value);
  const base = bounded(input.base, 0, 100);
  if (!Number.isInteger(base) || !Array.isArray(input.rules) || input.rules.length > 40) throw new Error("invalid_input");
  const rules = input.rules.map((value): ScoringRule => {
    const rule = record(value), weight = bounded(rule.weight, -100, 100);
    if (!Number.isInteger(weight) || !["technology", "title", "description", "keyword", "category", "budget"].includes(String(rule.field)) || typeof rule.term !== "string" || rule.term.length > 100 || (rule.field !== "budget" && !rule.term.trim())) throw new Error("invalid_input");
    if (rule.field !== "budget") return { field: rule.field as ScoringRule["field"], term: rule.term.trim(), weight };
    if (typeof rule.currency !== "string" || !/^[A-Z]{3}$/.test(rule.currency)) throw new Error("invalid_input");
    const minimum = rule.minimum === undefined ? undefined : bounded(rule.minimum, 0, 1e12);
    const maximum = rule.maximum === undefined ? undefined : bounded(rule.maximum, 0, 1e12);
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) throw new Error("invalid_input");
    return { field: "budget", term: "", weight, currency: rule.currency, ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }) };
  });
  return { base, rules };
}
export function parseProjectFilters(value: unknown): ProjectFilters {
  const input = { ...emptyProjectFilters, ...record(value) };
  const minBudget = input.minBudget === null ? null : bounded(input.minBudget, 0, 1e12);
  const maxBudget = input.maxBudget === null ? null : bounded(input.maxBudget, 0, 1e12);
  if (minBudget !== null && maxBudget !== null && minBudget > maxBudget) throw new Error("invalid_input");
  if (typeof input.currency !== "string" || !/^([A-Z]{3})?$/.test(input.currency) || !Array.isArray(input.skillIds) || input.skillIds.length > 50 || input.skillIds.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 1e6)) throw new Error("invalid_input");
  for (const date of [input.from, input.to]) if (typeof date !== "string" || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) throw new Error("invalid_input");
  if (input.from && input.to && input.from > input.to) throw new Error("invalid_input");
  const minScore = bounded(input.minScore, 0, 100), maxScore = bounded(input.maxScore, 0, 100);
  if (!Number.isInteger(minScore) || !Number.isInteger(maxScore) || minScore > maxScore || !["all", "new", "viewed", "saved", "hidden"].includes(input.state) || !["date", "relevance", "budget"].includes(input.sort)) throw new Error("invalid_input");
  return { minBudget, maxBudget, currency: input.currency, skillIds: [...new Set(input.skillIds)], categories: strings(input.categories), include: strings(input.include), exclude: strings(input.exclude), from: input.from, to: input.to, minScore, maxScore, state: input.state, sort: input.sort };
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
