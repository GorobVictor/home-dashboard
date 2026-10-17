import Link from "next/link";
import { redirect } from "next/navigation";
import { listNotificationChannels, listNotificationDeliveries } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { DashboardLiveUpdates } from "../../dashboard/live-updates";
import { RefreshButton } from "../../dashboard/refresh-button";
import { ChannelForm } from "./channel-form";
import { parseScoringProfile } from "@home-dashboard/integrations/freelancehunt-rules";

export default async function NotificationSettings({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const params = await searchParams;
  const requested = Number(params.page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
  const [channels, history] = await Promise.all([listNotificationChannels(), listNotificationDeliveries(undefined, page)]);
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-8 sm:py-8 lg:py-9"><DashboardLiveUpdates userId={user.id} />
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Notifications and Telegram</h1><nav className="flex gap-4 text-sm"><Link href="/settings" className="hover:underline">Settings</Link><Link href="/events" className="hover:underline">Events</Link><Link href="/dashboard" className="hover:underline">Dashboard</Link></nav></header>
    <p className="text-sm text-muted-foreground">Channels are shared by this home dashboard. Configure the bot token on the server through TELEGRAM_BOT_TOKEN in the worker. Add the bot to a chat or channel with permission to send messages. A test is sent after saving a channel and bypasses severity and source filters.</p>
    {channels.length === 0 && <p className="rounded-xl border p-4 text-muted-foreground">No channels are configured yet. Dashboard notifications work independently of Telegram.</p>}
    {channels.map((channel) => <ChannelForm key={`${channel.id}:${channel.updatedAt.toISOString()}`} channel={{ id: channel.id, name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, projectMinScore: channel.projectMinScore, ...(channel.projectScoring ? { projectScoring: parseScoringProfile(channel.projectScoring) } : {}), sources: Array.isArray(channel.sources) ? channel.sources.filter((source): source is string => typeof source === "string") : [] }} />)}
    <ChannelForm />
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Delivery history</h2><RefreshButton /></div><p className="text-xs text-muted-foreground">Up to six attempts use 5, 10, 20, 40 and 80 second delays. After a worker interruption, an unfinished attempt is recovered after two minutes. Telegram can receive a duplicate after an ambiguous network failure.</p>
      {history.items.length === 0 ? <p className="rounded-xl border p-6 text-muted-foreground">There are no delivery attempts yet. Without a bot token, notifications wait for worker configuration.</p> : <div className="space-y-2">{history.items.map((delivery) => <article key={delivery.id} className="space-y-1 rounded-lg border bg-card p-3 text-sm"><p className="break-words font-medium">{delivery.notification.event.title}</p><p className="break-all text-muted-foreground">{delivery.destination} · attempt {delivery.attempt} · {delivery.status} · {delivery.startedAt.toISOString().replace("T", " ").slice(0, 19)} UTC</p><p>Notification status: {delivery.notification.status}{delivery.notification.status === "pending" ? ` · next attempt ${delivery.notification.nextAttemptAt.toISOString()}` : ""}</p>{delivery.errorCode && <p className="text-destructive">{delivery.errorCode}</p>}{delivery.externalMessageId && <p className="text-xs text-muted-foreground">Telegram message ID: {delivery.externalMessageId}</p>}</article>)}</div>}
      <nav aria-label="Delivery pages" className="flex justify-between text-sm"><span>Attempts: {history.total}</span><div className="flex gap-4">{page > 1 && <Link className="hover:underline" href={`/settings/notifications?page=${page - 1}`}>Previous</Link>}{page * 30 < history.total && <Link className="hover:underline" href={`/settings/notifications?page=${page + 1}`}>Next</Link>}</div></nav>
    </section>
  </main></div>;
}
