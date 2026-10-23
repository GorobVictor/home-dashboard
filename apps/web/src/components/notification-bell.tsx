"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { severityLabels } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { notificationLink } from "@/lib/notification-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationListSkeleton } from "@/components/loading-state";
import { headerIconButtonClassName } from "@/lib/ui-layout";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";

type Inbox = { unreadCount: number; items: { id: string; readAt: string | null; event: { title: string; severity: string; occurredAt: string; source: string; type: string; payload: unknown } }[] };
export function NotificationBell() {
  const [inbox, setInbox] = useState<Inbox>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const data: Inbox = await response.json();
      if (!signal?.aborted) { setInbox(data); setError(false); }
    } catch { if (!signal?.aborted) setError(true); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void load(controller.signal); };
    refresh();
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("notifications.changed", refresh);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("notifications.changed", refresh); };
  }, [load]);
  async function markRead(id?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
      if (!response.ok) throw new Error();
      await load();
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <Popover><PopoverTrigger render={<Button variant="outline" size="icon" title="Сповіщення" aria-label={inbox ? `Сповіщення: ${inbox.unreadCount} непрочитаних` : "Сповіщення"} className={`relative ${headerIconButtonClassName}`} />} onClick={() => void load()}>
    <Bell aria-hidden="true" className="size-4" />{(inbox?.unreadCount ?? 0) > 0 && <Badge className="absolute -right-1 -top-1 min-w-4 justify-center px-1 text-[10px]" aria-hidden="true">{inbox!.unreadCount > 99 ? "99+" : inbox!.unreadCount}</Badge>}
  </PopoverTrigger><PopoverContent className="p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-2"><PopoverTitle className="font-semibold">Сповіщення</PopoverTitle><Button variant="ghost" size="sm" disabled={busy || !inbox?.unreadCount} onClick={() => void markRead()}>Прочитати всі</Button></div>
    <div aria-live="polite" className="h-[min(24rem,50dvh)] space-y-2 overflow-y-auto overscroll-contain">
      {error ? <div role="alert" className="text-sm text-destructive">Не вдалося оновити сповіщення. <button className="underline" onClick={() => void load()}>Повторити</button></div> : !inbox ? <NotificationListSkeleton /> : inbox.items.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Сповіщень поки немає.</p> : inbox.items.map((item) => <article key={item.id} className={`rounded-lg border p-2.5 sm:p-3 ${item.readAt ? "opacity-70" : "bg-muted/50"}`}>
        <div className="flex gap-2"><Badge variant="outline">{severityLabels[item.event.severity] ?? item.event.severity}</Badge>{!item.readAt && <span className="text-xs text-primary">Новий</span>}</div><p className="mt-2 break-words text-sm">{item.event.title}</p><time className="mt-1 block text-xs text-muted-foreground">{formatDate(item.event.occurredAt)} · Київ</time>
        {notificationLink(item.event) && <a className="mt-2 inline-flex min-h-11 items-center text-sm underline" href={notificationLink(item.event)!}>Відкрити</a>}
        {!item.readAt && <Button className="mt-2" variant="ghost" size="sm" disabled={busy} onClick={() => void markRead(item.id)}>Прочитано</Button>}
      </article>)}
    </div><div className="mt-4 flex justify-between border-t pt-3 text-sm"><Link className="inline-flex min-h-11 items-center hover:underline" href="/notifications">Усі сповіщення</Link><Link className="inline-flex min-h-11 items-center hover:underline" href="/settings/notifications">Налаштування</Link></div>
  </PopoverContent></Popover>;
}
