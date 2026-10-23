import { getDatabase } from "./client";
import { lockEventKey } from "./events";
export interface SiteInput { name: string; url: string; description: string; group: string; position: number }
export const listSites = () => getDatabase().site.findMany({ orderBy: [{ group: "asc" }, { position: "asc" }, { name: "asc" }] });
export async function saveSite(input: SiteInput, id?: string) {
  return getDatabase().$transaction(async tx => {
    await lockEventKey(tx, "sites");
    if (!id && await tx.site.count() >= 100) throw new Error("resource_limit");
    const site = id ? await tx.site.update({ where: { id }, data: input }) : await tx.site.create({ data: input });
    await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', '{"type":"sites.changed"}')`;
    return site;
  });
}
export async function removeSite(id: string) {
  return getDatabase().$transaction(async tx => {
    const site = await tx.site.delete({ where: { id } });
    await tx.$executeRaw`SELECT pg_notify('home_dashboard_events', '{"type":"sites.changed"}')`;
    return { id: site.id };
  });
}
