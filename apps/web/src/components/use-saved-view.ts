"use client";

import { useCallback, useSyncExternalStore } from "react";

export type SavedView = "cards" | "list";

const serverSnapshot = (): SavedView => "cards";

export function useSavedView(key: string): [SavedView, (view: SavedView) => void] {
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === key) notify(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("home-dashboard:view-changed", notify);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("home-dashboard:view-changed", notify); };
  }, [key]);
  const getSnapshot = useCallback((): SavedView => window.localStorage.getItem(key) === "list" ? "list" : "cards", [key]);
  const view = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const setView = useCallback((next: SavedView) => { window.localStorage.setItem(key, next); window.dispatchEvent(new Event("home-dashboard:view-changed")); }, [key]);
  return [view, setView];
}
