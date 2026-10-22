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
import { ArrowLeft, Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MobileDisclosure } from "@/components/mobile-disclosure";

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") query.set(key, value);
  let filters;
  try { filters = parseEventFilters(query); } catch { filters = null; }
  const result = filters ? await listEvents(filters) : null;
  const pageLink = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); return `/events?${next}`; };
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full min-w-0 max-w-6xl space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:px-8 sm:py-8"><DashboardLiveUpdates userId={user.id} />
    <PageHeader title="Event log"><NotificationBell /><Button variant="outline" size="icon" aria-label="Notification settings" title="Notification settings" render={<Link href="/settings/notifications" />}><Settings className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Dashboard" title="Dashboard" render={<Link href="/dashboard" />}><ArrowLeft className="size-4" /></Button></PageHeader>
    <MobileDisclosure label="Filter events" defaultOpen={Boolean(filters === null || [...query.keys()].some((key) => key !== "page"))}>
    <form className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
      <label className="space-y-1 text-sm">Source<select name="source" defaultValue={query.get("source") ?? ""} className="h-9 w-full rounded-md border bg-background px-3"><option value="">All</option>{["marstek", "freelancehunt", "system"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="space-y-1 text-sm">Severity<select name="severity" defaultValue={query.get("severity") ?? ""} className="h-9 w-full rounded-md border bg-background px-3"><option value="">All</option>{severities.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="col-span-2 min-w-0 space-y-1 text-sm lg:col-span-1">Type<Input name="type" placeholder="marstek.battery_low" defaultValue={query.get("type") ?? ""} maxLength={100} /></label>
      <label className="space-y-1 text-sm">From (UTC)<Input type="date" name="from" defaultValue={query.get("from") ?? ""} /></label><label className="space-y-1 text-sm">To (UTC)<Input type="date" name="to" defaultValue={query.get("to") ?? ""} /></label>
      <div className="flex items-end gap-3"><Button type="submit">Apply</Button><Link href="/events" className="py-2 text-sm hover:underline">Reset</Link></div>
    </form></MobileDisclosure>
    {!result ? <p role="alert" className="text-destructive">Invalid filters or date range.</p> : <><p className="text-sm text-muted-foreground">Events: {result.total}</p><div className="space-y-2 sm:space-y-3">{result.items.length === 0 ? <p className="rounded-xl border p-8 text-center text-muted-foreground">No events match these filters.</p> : result.items.map((event) => <article key={event.id} className="min-w-0 rounded-xl border bg-card p-3 sm:p-4"><div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline">{event.severity}</Badge><span>{event.source}</span><code className="order-3 w-full break-all text-muted-foreground sm:order-none sm:w-auto">{event.type}</code><time className="ml-auto text-[10px] text-muted-foreground sm:text-xs">{event.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC</time></div><h2 className="mt-2 break-words text-sm font-medium sm:mt-3 sm:text-base">{event.title}</h2><details className="mt-2 text-sm text-muted-foreground"><summary className="cursor-pointer">Event data</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(event.payload, null, 2)}</pre></details></article>)}</div>
      <nav aria-label="Event pages" className="flex items-center justify-between gap-3"><span>{result.page} / {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><div className="flex gap-4">{result.page > 1 && <Link href={pageLink(result.page - 1)} className="inline-flex min-h-11 items-center px-2 hover:underline">Previous</Link>}{result.page * result.pageSize < result.total && <Link href={pageLink(result.page + 1)} className="inline-flex min-h-11 items-center px-2 hover:underline">Next</Link>}</div></nav>
    </>}
  </main></div>;
}
