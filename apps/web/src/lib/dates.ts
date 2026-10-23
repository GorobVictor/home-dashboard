export const timeZone = "Europe/Kyiv";
export function formatDate(value: string | number | Date | null | undefined, dateOnly = false): string {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uk-UA", { timeZone, dateStyle: "medium", ...(dateOnly ? {} : { timeStyle: "short" }) }).format(date);
}

// shadcn's tooltip may pass a series label as its first argument.
export function chartDate(_label: unknown, payload: readonly { payload?: { timestamp?: unknown; time?: unknown } }[] = []): string {
  const point = payload[0]?.payload;
  const timestamp = point?.timestamp;
  return formatDate(typeof timestamp === "number" ? timestamp : typeof point?.time === "string" ? point.time : null);
}

export function customDateRange(from: string | undefined, to: string | undefined, now = new Date()) {
  if (!from && !to) return undefined;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Некоректні дати");
  const start = new Date(`${from}T00:00:00Z`), finish = new Date(`${to}T23:59:59.999Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(finish.getTime()) || start.toISOString().slice(0,10) !== from || finish.toISOString().slice(0,10) !== to || finish < start || finish.getTime() - start.getTime() > 90 * 864e5 || start > now || to > now.toISOString().slice(0,10)) throw new Error("Оберіть період до 90 днів без майбутніх дат");
  return { from: start, to: finish > now ? now : finish };
}
