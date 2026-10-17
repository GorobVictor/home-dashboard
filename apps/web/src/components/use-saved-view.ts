"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parseSavedView, type SavedView } from "@/lib/view-preferences";

export function useSavedView({ storageKey, cookieName }: { storageKey: string; cookieName: string }, initialView: SavedView): [SavedView, (view: SavedView) => void] {
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) notify(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("home-dashboard:view-changed", notify);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("home-dashboard:view-changed", notify); };
  }, [storageKey]);
  const getSnapshot = useCallback((): SavedView => {
    const value = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${cookieName}=`))?.split("=")[1];
    return value === undefined ? initialView : parseSavedView(value);
  }, [cookieName, initialView]);
  const serverSnapshot = useCallback(() => initialView, [initialView]);
  const view = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const setView = useCallback((next: SavedView) => {
    document.cookie = `${cookieName}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    try { window.localStorage.setItem(storageKey, next); } catch { /* The view still works when browser storage is unavailable. */ }
    window.dispatchEvent(new Event("home-dashboard:view-changed"));
  }, [cookieName, storageKey]);
  return [view, setView];
}
