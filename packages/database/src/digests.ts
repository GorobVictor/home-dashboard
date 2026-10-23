import type { Prisma } from "../generated/client/client";
import { getDatabase } from "./client";
import { publishEvent } from "./events";

const localDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" });
function midnight(day: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let pass = 0; pass < 3; pass++) guess += target - Date.parse(`${formatter.format(new Date(guess)).replace(" ", "T")}Z`);
  return new Date(guess);
}
export async function publishDailyDigests(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (hour < 9) return;
  const db = getDatabase(), today = localDay.format(now), until = midnight(today);
  const day = localDay.format(new Date(until.getTime() - 1)), from = midnight(day);
  const channels = await db.notificationChannel.findMany({ where: { enabled: true, digest: true } });
  const settings = await db.freelancehuntSettings.findUnique({ where: { id: "default" } });
  for (const channel of channels) {
    const key = `digest:${channel.id}:${day}`;
    if (await db.event.findUnique({ where: { deduplicationKey: key } })) continue;
    const sources = Array.isArray(channel.sources) ? channel.sources.filter((source): source is string => typeof source === "string") : [];
    const types = Array.isArray(channel.eventTypes) ? channel.eventTypes.filter((type): type is string => typeof type === "string") : [];
    const devices = Array.isArray(channel.deviceIds) ? channel.deviceIds.filter((device): device is string => typeof device === "string") : [];
    const where: Prisma.EventWhereInput = { occurredAt: { gte: from, lt: until }, NOT: { type: { in: ["system.daily_digest", "system.test_notification"] } },
      ...(sources.length ? { source: { in: sources } } : {}), ...(types.length ? { type: { in: types } } : {}),
      ...(devices.length ? { OR: devices.map(deviceId => ({ payload: { path: ["deviceId"], equals: deviceId } })) } : {}),
      ...(settings?.telegramEnabled === false ? { AND: [{ source: { not: "freelancehunt" } }] } : {}),
      severity: { in: ["info", "warning", "error", "critical"].slice(["info", "warning", "error", "critical"].indexOf(channel.minSeverity)) as ("info" | "warning" | "error" | "critical")[] } };
    const groups = await db.event.groupBy({ by: ["type"], where, _count: true });
    const projects = groups.find(group => group.type === "freelancehunt.project_created")?._count ?? 0;
    const messages = groups.find(group => group.type === "freelancehunt.message_received")?._count ?? 0;
    const total = groups.reduce((sum, group) => sum + group._count, 0);
    const energy = !sources.length || sources.includes("marstek") ? await db.marstekMinute.aggregate({ where: { bucketAt: { gte: from, lt: until }, ...(devices.length ? { deviceId: { in: devices } } : {}) }, _sum: { chargeEnergyWh: true, dischargeEnergyWh: true, energyCount: true } }) : null;
    const summary = `Подій: ${total} · Нових проєктів: ${projects} · Повідомлень: ${messages}` + (energy?._sum.energyCount ? ` · Заряджено: ${Math.round(energy._sum.chargeEnergyWh ?? 0)} Wh · Віддано: ${Math.round(energy._sum.dischargeEnergyWh ?? 0)} Wh` : " · Дані енергії відсутні");
    await publishEvent({ source: "system", type: "system.daily_digest", severity: "info", title: `Підсумок за ${day}`, payload: { summary, day }, deduplicationKey: key, channelId: channel.id, userIds: [] });
  }
}
