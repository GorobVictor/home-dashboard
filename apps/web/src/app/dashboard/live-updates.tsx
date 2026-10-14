"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
          if (message && typeof message === "object" && "type" in message && message.type === "marstek.measurement.saved") refresh();
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
