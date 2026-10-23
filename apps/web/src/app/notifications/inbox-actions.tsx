"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function InboxActions({ id }: { id?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <div><Button variant="outline" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { const response = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) }); if (!response.ok) throw new Error(); window.dispatchEvent(new Event("notifications.changed")); router.refresh(); }
    catch { setError("Не вдалося зберегти. Повторіть спробу."); } finally { setBusy(false); }
  }}>{id ? "Прочитано" : "Прочитати всі"}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
