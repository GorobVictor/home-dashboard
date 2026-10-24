"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function DashboardLiveUpdates({ userId }: { userId?: string }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const tab = params.get("tab");
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let socket: WebSocket | undefined, reconnectTimer: ReturnType<typeof setTimeout> | undefined, refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectDelay = 1000, stopped = false, lastMessage = Date.now();
    const refresh = () => {
      if (refreshTimer || document.hidden) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; router.refresh(); }, 500);
    };
    const expire = () => { stopped = true; socket?.close(); router.replace("/login"); router.refresh(); };
    const safeUrl = (value: unknown) => {
      try { const url = new URL(String(value)); return url.protocol === "https:" && url.hostname === "freelancehunt.com" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
    };
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/events`);
      socket.addEventListener("open", () => { reconnectDelay = 1000; lastMessage = Date.now(); setConnected(true); refresh(); window.dispatchEvent(new Event("marstek.measurement.saved")); });
      socket.addEventListener("message", event => {
        lastMessage = Date.now();
        try {
          const message: unknown = JSON.parse(String(event.data));
          if (!message || typeof message !== "object" || !("type" in message)) return;
          if (message.type === "connection.ready" || message.type === "connection.resynced") { refresh(); return; }
          if (message.type === "marstek.measurement.saved") { window.dispatchEvent(new Event("marstek.measurement.saved")); return; }
          if (message.type === "notifications.changed") {
            window.dispatchEvent(new Event("notifications.changed"));
            if (pathname !== "/dashboard" || tab === "freelancehunt") refresh();
          }
          if (message.type === "sites.changed" && tab === "sites") refresh();
          if (message.type === "freelancehunt.project.discovered" && "project" in message && message.project && typeof message.project === "object" && "name" in message.project) {
            const project = message.project as { name: unknown; url?: unknown };
            const eligible = !("recipientIds" in message) || (Array.isArray(message.recipientIds) && message.recipientIds.includes(userId));
            const url = safeUrl(project.url);
            if (eligible && typeof project.name === "string") toast.info(`Новий проєкт: ${project.name}`, url ? { action: { label: "Відкрити", onClick: () => window.open(url, "_blank", "noopener,noreferrer") } } : undefined);
            if (tab === "freelancehunt") refresh();
          }
          if (message.type === "freelancehunt.message.discovered" && "thread" in message && message.thread && typeof message.thread === "object" && "subject" in message.thread) {
            const thread = message.thread as { subject: unknown; url?: unknown }, url = safeUrl(thread.url);
            if (typeof thread.subject === "string") toast.info(`Нове повідомлення: ${thread.subject}`, url ? { action: { label: "Відкрити", onClick: () => window.open(url, "_blank", "noopener,noreferrer") } } : undefined);
          }
        } catch { /* HTTP remains authoritative after malformed invalidations. */ }
      });
      socket.addEventListener("close", event => {
        setConnected(false);
        if (event.code === 4401) { expire(); return; }
        if (!stopped) { reconnectTimer = setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay * 2, 30000); }
      });
    };
    const wake = () => { if (!document.hidden) { refresh(); window.dispatchEvent(new Event("marstek.measurement.saved")); } };
    const storage = (event: StorageEvent) => { if (event.key === "home-dashboard:logout") expire(); };
    const fallback = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessage > 70000) socket.close();
      if (pathname !== "/dashboard" || tab !== "sites") refresh();
    }, 60000);
    window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake); window.addEventListener("storage", storage);
    connect();
    return () => { stopped = true; clearTimeout(reconnectTimer); clearTimeout(refreshTimer); clearInterval(fallback); socket?.close(); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("storage", storage); };
  }, [router, userId, pathname, tab]);
  return <span role="status" aria-label={connected ? "Live-зв’язок активний" : "Live-зв’язок відсутній, резервне оновлення активне"} title={connected ? "Дані оновлюються через WebSocket" : "Резервне оновлення активне; з’єднання відновлюється автоматично"} className={`inline-flex items-center gap-1.5 text-[10px] font-medium whitespace-nowrap ${connected ? "text-emerald-300" : "text-amber-200"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{connected ? "Наживо" : "Резервний режим"}</span>;
}
