const apiBaseUrl = "https://api.freelancehunt.com/v2";

export class FreelancehuntError extends Error {
  constructor(public readonly code: string, public readonly retryAfterSeconds = 0) { super(code); }
}

export interface FreelancehuntProject {
  id: number;
  name: string;
  description: string | null;
  url: string;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  skills: string[];
  skillIds?: number[];
  categories?: string[];
  publishedAt: Date | null;
}

export interface FreelancehuntThread {
  id: number;
  subject: string;
  url: string;
  lastPostedAt: Date | null;
  messagesCount: number;
  isUnread: boolean;
}

export interface FreelancehuntSkill {
  id: number;
  name: string;
  groupName: string;
}

type ApiObject = Record<string, unknown>;

function object(value: unknown): ApiObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiObject : null;
}

function text(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function date(value: unknown): Date | null {
  const parsed = typeof value === "string" ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function link(value: unknown, fallback: string): string {
  const record = object(value);
  const web = record && text(record.web, 2048);
  if (web) {
    try { const url = new URL(web); if (url.protocol === "https:" && url.hostname === "freelancehunt.com" && !url.username && !url.password) return url.href; } catch { /* Use canonical fallback. */ }
  }
  return fallback;
}

export class FreelancehuntClient {
  constructor(private readonly token: string, private readonly timeoutMs = 10_000, private readonly baseUrl = apiBaseUrl) {}

  async getProject(id: number): Promise<FreelancehuntProject & { status: string | null; bidCount: number | null; expiresAt: Date | null }> {
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new Error("invalid_project_id");
    const data = await this.request(`/projects/${id}`);
    const project = this.toProject(data);
    if (!project || project.id !== id) throw new Error("freelancehunt_invalid_project_response");
    const attributes = object(object(data)?.attributes);
    const status = object(attributes?.status);
    const bids = number(attributes?.bid_count);
    return { ...project, status: text(status?.name, 100), bidCount: bids !== null && Number.isSafeInteger(bids) && bids >= 0 ? bids : null, expiresAt: date(attributes?.expired_at) };
  }

  async listProjects(skillIds: number[]): Promise<FreelancehuntProject[]> {
    return (await this.projectPage(skillIds, 1)).items;
  }

  async projectPage(skillIds: number[], page: number) {
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error("invalid_page");
    const query = new URLSearchParams();
    if (skillIds.length > 0) query.set("filter[skill_id]", skillIds.join(","));
    query.set("page[number]", String(page));
    const envelope = await this.requestEnvelope(`/projects?${query.toString()}`);
    const data = envelope.data;
    if (!Array.isArray(data)) throw new Error("freelancehunt_invalid_projects_response");
    return { items: data.map((item) => this.toProject(item)).filter((item): item is FreelancehuntProject => item !== null), more: typeof object(envelope.links)?.next === "string" };
  }

  async listThreads(): Promise<FreelancehuntThread[]> {
    return (await this.threadPage(1)).items;
  }

  async threadPage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error("invalid_page");
    const envelope = await this.requestEnvelope(`/threads?page[number]=${page}`), data = envelope.data;
    if (!Array.isArray(data)) throw new Error("freelancehunt_invalid_threads_response");
    return { items: data.map((item) => this.toThread(item)).filter((item): item is FreelancehuntThread => item !== null), more: typeof object(envelope.links)?.next === "string" };
  }

  async listSkills(): Promise<FreelancehuntSkill[]> {
    const data = await this.request("/skills");
    if (!Array.isArray(data)) throw new Error("freelancehunt_invalid_skills_response");
    return data.flatMap((item) => {
      const skill = object(item);
      const id = skill && number(skill.id);
      const attributes = skill && object(skill.attributes);
      const name = attributes && text(attributes.name, 100);
      const group = attributes && object(attributes.group);
      const groupName = group && text(group.name, 100);
      return id && Number.isInteger(id) && id > 0 && name && groupName ? [{ id, name, groupName }] : [];
    }).sort((left, right) => left.groupName.localeCompare(right.groupName, "uk") || left.name.localeCompare(right.name, "uk"));
  }

  private async request(path: string): Promise<unknown> {
    return (await this.requestEnvelope(path)).data;
  }

  private async requestEnvelope(path: string): Promise<ApiObject> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json", "Accept-Language": "uk" },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retry = response.headers.get("retry-after");
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.ceil((Date.parse(retry) - Date.now()) / 1000) : 60;
        throw new FreelancehuntError(response.status === 429 ? "freelancehunt_rate_limited" : `freelancehunt_http_${response.status}`, response.status === 429 ? Math.min(86400, Math.max(60, Number.isFinite(seconds) ? seconds : 60)) : 0);
      }
      const body = object(await response.json());
      if (!body || !("data" in body)) throw new Error("freelancehunt_invalid_response");
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("freelancehunt_timeout");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private toProject(value: unknown): FreelancehuntProject | null {
    const entry = object(value);
    const attributes = entry && object(entry.attributes);
    const id = entry && number(entry.id);
    const name = attributes && text(attributes.name, 500);
    if (!entry || !attributes || !id || !Number.isInteger(id) || id < 1 || !name) return null;
    const budget = object(attributes.budget);
    const skills = Array.isArray(attributes.skills) ? attributes.skills.flatMap((skill) => {
      const item = object(skill); const skillName = item && text(item.name, 100); return skillName ? [skillName] : [];
    }) : [];
    const skillIds = Array.isArray(attributes.skills) ? attributes.skills.flatMap((skill) => {
      const id = number(object(skill)?.id); return id && Number.isSafeInteger(id) && id > 0 && id <= 1e6 ? [id] : [];
    }) : [];
    const links = object(entry.links);
    return {
      id, name, description: text(attributes.description, 50_000),
      url: link(links?.self, `https://freelancehunt.com/project/${id}.html`),
      budgetAmount: budget ? number(budget.amount) : null,
      budgetCurrency: budget ? text(budget.currency, 8) : null,
      skills, skillIds: [...new Set(skillIds)], categories: [], publishedAt: date(attributes.published_at) ?? date(attributes.created_at),
    };
  }

  private toThread(value: unknown): FreelancehuntThread | null {
    const entry = object(value);
    const attributes = entry && object(entry.attributes);
    const id = entry && number(entry.id);
    const subject = attributes && text(attributes.subject, 500);
    if (!entry || !attributes || !id || !Number.isInteger(id) || id < 1 || !subject) return null;
    const count = number(attributes.messages_count);
    const links = object(entry.links);
    return {
      id, subject, url: link(links?.self, `https://freelancehunt.com/mailbox/read/thread/${id}`),
      lastPostedAt: date(attributes.last_post_at), messagesCount: count && Number.isInteger(count) && count >= 0 ? count : 0,
      isUnread: attributes.is_unread === true,
    };
  }
}

export async function sendTelegramMessage(token: string, chatId: string, message: string): Promise<void> {
  const { deliverTelegramMessage } = await import("./telegram");
  await deliverTelegramMessage(token, chatId, message);
}
