import Link from "next/link";
import { redirect } from "next/navigation";
import { listNotificationChannels, listNotificationDeliveries } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { DashboardLiveUpdates } from "../../dashboard/live-updates";
import { RefreshButton } from "../../dashboard/refresh-button";
import { ChannelForm } from "./channel-form";
import { parseScoringProfile } from "@home-dashboard/integrations/freelancehunt-rules";
import { ArrowLeft, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export default async function NotificationSettings({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const params = await searchParams;
  const requested = Number(params.page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
  const [channels, history] = await Promise.all([listNotificationChannels(), listNotificationDeliveries(undefined, page)]);
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full min-w-0 max-w-7xl space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:px-8 sm:py-8 lg:py-9"><DashboardLiveUpdates userId={user.id} />
    <PageHeader title="Notifications and Telegram" mobileTitle="Notifications"><Button variant="outline" size="icon" aria-label="Settings" title="Settings" render={<Link href="/settings" />}><Settings className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Event log" title="Event log" render={<Link href="/events" />}><List className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Dashboard" title="Dashboard" render={<Link href="/dashboard" />}><ArrowLeft className="size-4" /></Button></PageHeader>
    <details className="rounded-xl border bg-card p-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Telegram setup and delivery</summary><p className="mt-2 leading-6">Channels are shared by this home dashboard. Configure the bot token on the server through TELEGRAM_BOT_TOKEN in the worker. Add the bot to a chat or channel with permission to send messages. A test is sent after saving a channel and bypasses severity and source filters.</p></details>
    {channels.length === 0 && <p className="rounded-xl border p-4 text-muted-foreground">No channels are configured yet. Dashboard notifications work independently of Telegram.</p>}
    {channels.map((channel) => <ChannelForm key={`${channel.id}:${channel.updatedAt.toISOString()}`} channel={{ id: channel.id, name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, projectMinScore: channel.projectMinScore, ...(channel.projectScoring ? { projectScoring: parseScoringProfile(channel.projectScoring) } : {}), sources: Array.isArray(channel.sources) ? channel.sources.filter((source): source is string => typeof source === "string") : [] }} />)}
    <ChannelForm />
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Delivery history</h2><RefreshButton /></div><p className="text-xs text-muted-foreground">Up to six attempts use 5, 10, 20, 40 and 80 second delays. After a worker interruption, an unfinished attempt is recovered after two minutes. Telegram can receive a duplicate after an ambiguous network failure.</p>
      {history.items.length === 0 ? <p className="rounded-xl border p-6 text-muted-foreground">There are no delivery attempts yet. Without a bot token, notifications wait for worker configuration.</p> : <div className="space-y-2">{history.items.map((delivery) => <article key={delivery.id} className="min-w-0 space-y-1 rounded-lg border bg-card p-3 text-xs sm:text-sm"><p className="break-words font-medium">{delivery.notification.event.title}</p><p className="break-all text-muted-foreground">{delivery.destination} · attempt {delivery.attempt} · {delivery.status} · {delivery.startedAt.toISOString().replace("T", " ").slice(0, 19)} UTC</p><p className="break-words">Notification status: {delivery.notification.status}{delivery.notification.status === "pending" ? ` · next attempt ${delivery.notification.nextAttemptAt.toISOString()}` : ""}</p>{delivery.errorCode && <p className="text-destructive">{delivery.errorCode}</p>}{delivery.externalMessageId && <p className="text-xs text-muted-foreground">Telegram message ID: {delivery.externalMessageId}</p>}</article>)}</div>}
      <nav aria-label="Delivery pages" className="flex justify-between text-sm"><span>Attempts: {history.total}</span><div className="flex gap-4">{page > 1 && <Link className="inline-flex min-h-11 items-center px-2 hover:underline" href={`/settings/notifications?page=${page - 1}`}>Previous</Link>}{page * 30 < history.total && <Link className="inline-flex min-h-11 items-center px-2 hover:underline" href={`/settings/notifications?page=${page + 1}`}>Next</Link>}</div></nav>
    </section>
  </main></div>;
}
