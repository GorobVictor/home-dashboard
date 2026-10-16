import Link from "next/link";
import { redirect } from "next/navigation";
import { listEvents, severities } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { parseEventFilters } from "@/server/notifications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLiveUpdates } from "../dashboard/live-updates";
import { NotificationBell } from "@/components/notification-bell";

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!await currentUser()) redirect("/login");
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") query.set(key, value);
  let filters;
  try { filters = parseEventFilters(query); } catch { filters = null; }
  const result = filters ? await listEvents(filters) : null;
  const pageLink = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); return `/events?${next}`; };
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8"><DashboardLiveUpdates />
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Журнал подій</h1><div className="flex items-center gap-4"><NotificationBell /><Link href="/dashboard" className="text-sm hover:underline">Dashboard</Link><Link href="/settings/notifications" className="text-sm hover:underline">Налаштування</Link></div></header>
    <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm">Джерело<select name="source" defaultValue={query.get("source") ?? ""} className="h-9 w-full rounded-md border bg-background px-3"><option value="">Усі</option>{["marstek", "freelancehunt", "system"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="space-y-1 text-sm">Тип<Input name="type" placeholder="marstek.battery_low" defaultValue={query.get("type") ?? ""} maxLength={100} /></label>
      <label className="space-y-1 text-sm">Важливість<select name="severity" defaultValue={query.get("severity") ?? ""} className="h-9 w-full rounded-md border bg-background px-3"><option value="">Усі</option>{severities.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="space-y-1 text-sm">Від (UTC)<Input type="date" name="from" defaultValue={query.get("from") ?? ""} /></label><label className="space-y-1 text-sm">До (UTC)<Input type="date" name="to" defaultValue={query.get("to") ?? ""} /></label>
      <div className="flex items-end gap-3"><Button type="submit">Застосувати</Button><Link href="/events" className="py-2 text-sm hover:underline">Скинути</Link></div>
    </form>
    {!result ? <p role="alert" className="text-destructive">Некоректні фільтри або діапазон дат.</p> : <><p className="text-sm text-muted-foreground">Подій: {result.total}</p><div className="space-y-3">{result.items.length === 0 ? <p className="rounded-xl border p-8 text-center text-muted-foreground">За цими фільтрами подій немає.</p> : result.items.map((event) => <article key={event.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline">{event.severity}</Badge><span>{event.source}</span><code className="break-all text-muted-foreground">{event.type}</code><time className="sm:ml-auto">{event.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC</time></div><h2 className="mt-3 break-words font-medium">{event.title}</h2><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Дані події</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(event.payload, null, 2)}</pre></details></article>)}</div>
      <nav aria-label="Сторінки подій" className="flex items-center justify-between gap-3"><span>{result.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><div className="flex gap-4">{result.page > 1 && <Link href={pageLink(result.page - 1)} className="hover:underline">Попередня</Link>}{result.page * result.pageSize < result.total && <Link href={pageLink(result.page + 1)} className="hover:underline">Наступна</Link>}</div></nav>
    </>}
  </main></div>;
}
