"use client";

import { HelpText } from "@/components/help-text";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SiteInput } from "@home-dashboard/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function SiteEditor({ site }: { site?: SiteInput & { id: string } }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await action(site ? "PUT" : "POST", { name: String(data.get("name")), url: String(data.get("url")), description: String(data.get("description")), group: String(data.get("group")), position: Number(data.get("position")) });
    if (!site) form.reset();
  }
  async function action(method: string, body?: SiteInput) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/sites${site ? `/${site.id}` : ""}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); if (!response.ok) throw new Error(); router.refresh(); }
    catch { setError("Не вдалося зберегти. Перевірте HTTPS-адресу та поля."); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-medium">{site?.name ?? "Додати сайт"}</h2><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><HelpText>Назва</HelpText><Input aria-label="Назва" name="name" required maxLength={100} defaultValue={site?.name} /></label><label className="space-y-1 text-sm"><HelpText>HTTPS-адреса</HelpText><Input aria-label="HTTPS-адреса" name="url" type="url" required maxLength={2048} defaultValue={site?.url} placeholder="https://example.com" /></label><label className="space-y-1 text-sm"><HelpText>Група</HelpText><Input aria-label="Група" name="group" required maxLength={100} defaultValue={site?.group ?? "Сервіси"} /></label><label className="space-y-1 text-sm"><HelpText>Порядок</HelpText><Input aria-label="Порядок" name="position" type="number" required min={0} max={99999} defaultValue={site?.position ?? 0} /></label><label className="space-y-1 text-sm sm:col-span-2"><HelpText>Опис</HelpText><Input aria-label="Опис" name="description" maxLength={300} defaultValue={site?.description} /></label></fieldset><div className="flex gap-3"><Button type="submit" disabled={busy}>Зберегти</Button>{site && <Button type="button" disabled={busy} variant="outline" onClick={() => void action("DELETE")}>Видалити</Button>}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>;
}
