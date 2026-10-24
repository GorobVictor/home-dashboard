import { HelpText } from "@/components/help-text";
import Link from "next/link";
import { deliveryLabels } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { redirect } from "next/navigation";
import { listNotificationChannels, listNotificationDeliveries, listMarstekDevices } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { RefreshButton } from "../../dashboard/refresh-button";
import { ChannelForm } from "./channel-form";
import { ChevronDown, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function NotificationSettings({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const params = await searchParams;
  const requested = Number(params.page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
  const [channels, history, devices] = await Promise.all([listNotificationChannels(), listNotificationDeliveries(undefined, page), listMarstekDevices()]);
  return <>
    <details className="rounded-xl border bg-card p-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Налаштування Telegram і доставки</summary><p className="mt-2 leading-6">Канали спільні для користувачів дашборда. Налаштуйте токен бота на сервері та додайте бота до чату з правом надсилання. Після збереження можна надіслати тест; він оминає фільтри й тихі години.</p></details>
    {channels.length === 0 && <p className="rounded-xl border p-4 text-muted-foreground">Каналів поки немає. Сповіщення в дашборді працюють незалежно від Telegram.</p>}
    {channels.map((channel) => <ChannelForm devices={devices.map(device => ({ id: device.id, name: device.name }))} key={`${channel.id}:${channel.updatedAt.toISOString()}`} channel={{ id: channel.id, name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, eventTypes: Array.isArray(channel.eventTypes) ? channel.eventTypes.filter((v): v is string => typeof v === "string") : [], deviceIds: Array.isArray(channel.deviceIds) ? channel.deviceIds.filter((v): v is string => typeof v === "string") : [], quietFrom: channel.quietFrom, quietTo: channel.quietTo, digest: channel.digest, sources: Array.isArray(channel.sources) ? channel.sources.filter((source): source is string => typeof source === "string") : [] }} />)}
    {channels.length ? <details className="group"><summary className="surface-panel flex cursor-pointer list-none items-center gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden"><Plus aria-hidden="true" className="size-4 text-primary" />Додати Telegram-канал<ChevronDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="mt-3"><ChannelForm devices={devices.map(device => ({ id: device.id, name: device.name }))} /></div></details> : <ChannelForm devices={devices.map(device => ({ id: device.id, name: device.name }))} />}
    <section id="delivery-history" className="scroll-mt-20 space-y-3"><div className="flex items-center justify-between"><h2 aria-label="Історія доставки" className="text-xl font-semibold"><HelpText>Історія доставки</HelpText></h2><RefreshButton /></div><p className="text-xs text-muted-foreground">До шести спроб із затримками 5, 10, 20, 40 і 80 секунд. Після зупинки worker незавершена спроба відновлюється через дві хвилини. Після неоднозначного мережевого збою можлива повторна доставка.</p>
      <DeliveryPagination page={history.page} pageSize={history.pageSize} total={history.total} position="top" />
      {history.items.length === 0 ? <p className="rounded-xl border p-6 text-muted-foreground">Спроб доставки поки немає. Без токена бота сповіщення очікують налаштування worker.</p> : <div className="space-y-2">{history.items.map((delivery) => <article key={delivery.id} className="min-w-0 space-y-1 rounded-lg border bg-card p-3 text-xs sm:text-sm"><p className="break-words font-medium">{delivery.notification.event.title}</p><p className="break-all text-muted-foreground">{delivery.destination} · спроба {delivery.attempt} · {deliveryLabels[delivery.status] ?? delivery.status} · {formatDate(delivery.startedAt)} · Київ</p><p className="break-words"><HelpText>Стан сповіщення</HelpText>: {deliveryLabels[delivery.notification.status] ?? delivery.notification.status}{delivery.notification.status === "pending" ? ` · наступна спроба ${formatDate(delivery.notification.nextAttemptAt)} · Київ` : ""}</p>{delivery.errorCode && <p className="text-destructive">{delivery.errorCode}</p>}{delivery.externalMessageId && <p className="text-xs text-muted-foreground">ID повідомлення Telegram: {delivery.externalMessageId}</p>}</article>)}</div>}
      <DeliveryPagination page={history.page} pageSize={history.pageSize} total={history.total} position="bottom" />
    </section>
  </>;
}

function DeliveryPagination({ page, pageSize, total, position }: { page: number; pageSize: number; total: number; position: "top" | "bottom" }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label={`Delivery pages (${position})`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
    <div className="text-xs text-muted-foreground sm:text-sm"><p>Спроб: {total}</p><p>Сторінка {page} / {pages}</p></div>
    <div className="flex gap-2">
      {page > 1 ? <Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`/settings/notifications?page=${page - 1}#delivery-history`}>Назад</Link> : <Button variant="outline" className="min-h-11" disabled>Назад</Button>}
      {page < pages ? <Link className={buttonVariants({ variant: "outline", className: "min-h-11" })} href={`/settings/notifications?page=${page + 1}#delivery-history`}>Далі</Link> : <Button variant="outline" className="min-h-11" disabled>Далі</Button>}
    </div>
  </nav>;
}
