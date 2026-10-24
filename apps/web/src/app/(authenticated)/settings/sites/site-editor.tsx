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
    const saved = await action(site ? "PUT" : "POST", { name: String(data.get("name")), url: String(data.get("url")), description: String(data.get("description")), group: String(data.get("group")), position: Number(data.get("position")) });
    if (!site && saved) form.reset();
  }
  async function action(method: string, body?: SiteInput) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/sites${site ? `/${site.id}` : ""}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); if (!response.ok) throw new Error(); router.refresh(); return true; }
    catch { setError("Не вдалося зберегти. Перевірте HTTPS-адресу та поля."); return false; } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="surface-panel space-y-5"><h2 className="font-medium">{site?.name ?? "Додати сайт"}</h2><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><label className="form-field"><HelpText>Назва</HelpText><Input aria-label="Назва" name="name" required maxLength={100} defaultValue={site?.name} /></label><label className="form-field"><HelpText>HTTPS-адреса</HelpText><Input aria-label="HTTPS-адреса" name="url" type="url" required maxLength={2048} defaultValue={site?.url} placeholder="https://example.com" /></label><label className="form-field"><HelpText>Група</HelpText><Input aria-label="Група" name="group" required maxLength={100} defaultValue={site?.group ?? "Сервіси"} /></label><label className="form-field"><HelpText>Порядок</HelpText><Input aria-label="Порядок" name="position" type="number" required min={0} max={99999} defaultValue={site?.position ?? 0} /></label><label className="form-field sm:col-span-2"><HelpText>Опис</HelpText><Input aria-label="Опис" name="description" maxLength={300} defaultValue={site?.description} /></label></fieldset><div className="grid gap-3 sm:flex"><Button type="submit" disabled={busy}>Зберегти</Button>{site && <Button type="button" disabled={busy} variant="outline" onClick={() => void action("DELETE")}>Видалити</Button>}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>;
}
