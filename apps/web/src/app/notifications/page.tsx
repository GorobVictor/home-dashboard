import Link from "next/link";
import { redirect } from "next/navigation";
import { listNotifications } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { severityLabels } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { notificationLink } from "@/lib/notification-link";
import { DashboardLiveUpdates } from "../dashboard/live-updates";
import { PageHeader } from "@/components/page-header";
import { InboxActions } from "./inbox-actions";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; unread?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const params = await searchParams, page = Math.min(10000, Math.max(1, Number(params.page) || 1)), unread = params.unread === "true";
  const inbox = await listNotifications(user.id, Math.floor(page), unread);
  const pages = Math.max(1, Math.ceil(inbox.total / inbox.pageSize));
  const href = (value: number) => `/notifications?page=${value}&unread=${unread}`;
  return <main className="dashboard-shell min-h-screen p-3 sm:p-8"><div className="mx-auto max-w-4xl space-y-4"><PageHeader title="Мої сповіщення"><Link href="/dashboard" className="underline">Дашборд</Link></PageHeader><DashboardLiveUpdates userId={user.id} />
    <div className="flex flex-wrap items-center gap-3"><Link className="rounded border px-3 py-2" href={`/notifications?unread=${!unread}`}>{unread ? "Показати всі" : "Лише непрочитані"}</Link><span>Непрочитаних: {inbox.unreadCount}</span><InboxActions /></div>
    {!inbox.items.length && <p className="rounded-xl border p-6">Сповіщень немає.</p>}
    {inbox.items.map(item => { const link = notificationLink(item.event); return <article key={item.id} className={`space-y-2 rounded-xl border bg-card p-4 ${item.readAt ? "opacity-70" : "border-primary/40"}`}><p className="text-xs text-muted-foreground">{severityLabels[item.event.severity] ?? item.event.severity} · {formatDate(item.event.occurredAt)} · Київ</p><h2 className="break-words font-medium">{item.event.title}</h2><div className="flex flex-wrap gap-4">{link && <a className="inline-flex min-h-11 items-center underline" href={link}>Відкрити</a>}{!item.readAt && <InboxActions id={item.id} />}</div></article>; })}
    <nav aria-label="Сторінки сповіщень" className="flex items-center justify-between">{page > 1 ? <Link className="p-3 underline" href={href(page - 1)}>Назад</Link> : <span />}<span>{page} / {pages}</span>{page < pages ? <Link className="p-3 underline" href={href(page + 1)}>Далі</Link> : <span />}</nav>
  </div></main>;
}
