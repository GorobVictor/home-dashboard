const apiBaseUrl = "https://api.freelancehunt.com/v2";

export interface FreelancehuntProject {
  id: number;
  name: string;
  description: string | null;
  url: string;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  skills: string[];
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
  return web ?? fallback;
}

export class FreelancehuntClient {
  constructor(private readonly token: string, private readonly timeoutMs = 10_000) {}

  async listProjects(skillIds: number[]): Promise<FreelancehuntProject[]> {
    const query = new URLSearchParams();
    if (skillIds.length > 0) query.set("filter[skill_id]", skillIds.join(","));
    query.set("page[number]", "1");
    const data = await this.request(`/projects?${query.toString()}`);
    if (!Array.isArray(data)) throw new Error("freelancehunt_invalid_projects_response");
    return data.map((item) => this.toProject(item)).filter((item): item is FreelancehuntProject => item !== null);
  }

  async listThreads(): Promise<FreelancehuntThread[]> {
    const data = await this.request("/threads?page[number]=1");
    if (!Array.isArray(data)) throw new Error("freelancehunt_invalid_threads_response");
    return data.map((item) => this.toThread(item)).filter((item): item is FreelancehuntThread => item !== null);
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json", "Accept-Language": "uk" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 429 ? "freelancehunt_rate_limited" : `freelancehunt_http_${response.status}`);
      const body = object(await response.json());
      if (!body || !("data" in body)) throw new Error("freelancehunt_invalid_response");
      return body.data;
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
    const links = object(entry.links);
    return {
      id, name, description: text(attributes.description, 50_000),
      url: link(links?.self, `https://freelancehunt.com/project/${id}.html`),
      budgetAmount: budget ? number(budget.amount) : null,
      budgetCurrency: budget ? text(budget.currency, 8) : null,
      skills, publishedAt: date(attributes.published_at) ?? date(attributes.created_at),
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`telegram_http_${response.status}`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("telegram_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
