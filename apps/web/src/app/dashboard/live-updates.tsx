"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DashboardLiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectDelay = 1_000;
    let stopped = false;

    const refresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        router.refresh();
      }, 250);
    };
    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/events`);
      socket.addEventListener("open", () => { reconnectDelay = 1_000; });
      socket.addEventListener("message", (event) => {
        try {
          const message: unknown = JSON.parse(String(event.data));
          if (!message || typeof message !== "object" || !("type" in message)) return;
          if (message.type === "marstek.measurement.saved") refresh();
          if (message.type === "freelancehunt.project.discovered" && "project" in message && message.project && typeof message.project === "object" && "name" in message.project) {
            const project = message.project as { name: unknown; url?: unknown };
            const projectUrl = typeof project.url === "string" ? project.url : undefined;
            if (typeof project.name === "string") toast.info(`New Freelancehunt project: ${project.name}`, projectUrl ? { action: { label: "Open", onClick: () => window.open(projectUrl, "_blank", "noopener,noreferrer") } } : undefined);
            refresh();
          }
          if (message.type === "freelancehunt.message.discovered" && "thread" in message && message.thread && typeof message.thread === "object" && "subject" in message.thread) {
            const thread = message.thread as { subject: unknown; url?: unknown };
            const threadUrl = typeof thread.url === "string" ? thread.url : undefined;
            if (typeof thread.subject === "string") toast.info(`New Freelancehunt message: ${thread.subject}`, threadUrl ? { action: { label: "Open", onClick: () => window.open(threadUrl, "_blank", "noopener,noreferrer") } } : undefined);
            refresh();
          }
        } catch {
          // Invalid events are ignored; the periodic refresh remains the fallback.
        }
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      });
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearTimeout(refreshTimer);
      socket?.close();
    };
  }, [router]);

  return null;
}
