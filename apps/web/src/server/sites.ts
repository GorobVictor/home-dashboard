import type { SiteInput } from "@home-dashboard/database";
import { NotificationInputError } from "./notifications";
export function parseSite(body: Record<string, unknown>): SiteInput {
  if (Object.keys(body).some(key => !["name", "url", "description", "group", "position"].includes(key)) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 100 || typeof body.url !== "string" || body.url.length > 2048 || typeof body.description !== "string" || body.description.length > 300 || typeof body.group !== "string" || !body.group.trim() || body.group.length > 100 || !Number.isInteger(body.position) || Number(body.position) < 0 || Number(body.position) > 99999) throw new NotificationInputError();
  let url: URL; try { url = new URL(body.url); } catch { throw new NotificationInputError(); }
  if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048 || /[\u0000-\u0020]/.test(body.url)) throw new NotificationInputError();
  return { name: body.name.trim(), url: url.href, description: body.description.trim(), group: body.group.trim(), position: Number(body.position) };
}
