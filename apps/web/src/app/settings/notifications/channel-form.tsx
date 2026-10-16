"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChannelInput } from "@home-dashboard/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const emptyChannel: ChannelInput = { name: "", chatId: "", enabled: true, minSeverity: "info", sources: [] };
export function ChannelForm({ channel }: { channel?: ChannelInput & { id: string } }) {
  const router = useRouter();
  const [values, setValues] = useState<ChannelInput>(channel ? { name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, sources: channel.sources } : emptyChannel);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function action(kind: "save" | "test" | "disable") {
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/notification-channels${channel ? `/${channel.id}` : ""}${kind === "test" ? "/test" : ""}`, {
        method: kind === "test" ? "POST" : kind === "disable" ? "DELETE" : channel ? "PUT" : "POST",
        headers: { "content-type": "application/json" }, ...(kind === "save" ? { body: JSON.stringify(values) } : {}),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error === "test_rate_limited" ? "Зачекайте 30 секунд перед наступним тестом." : data.error === "channel_already_exists" ? "Канал із таким chat ID вже існує." : data.error === "channel_disabled" ? "Увімкніть і збережіть канал перед тестуванням." : "Не вдалося виконати дію. Перевірте дані та повторіть.");
      }
      setMessage(kind === "test" ? "Тест поставлено на доставку. Результат з’явиться в історії." : "Збережено.");
      if (!channel) setValues(emptyChannel);
      router.refresh();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Помилка запиту."); }
    finally { setBusy(false); }
  }
  const prefix = channel?.id ?? "new";
  return <form onSubmit={(event) => { event.preventDefault(); void action("save"); }} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <h2 className="font-semibold">{channel ? channel.name : "Додати Telegram-канал"}</h2>
    <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm">Назва<Input required maxLength={100} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label><label className="space-y-1 text-sm">Chat ID<Input required maxLength={100} placeholder="-1001234567890 або @channel" value={values.chatId} onChange={(event) => setValues({ ...values, chatId: event.target.value })} pattern="(-?[0-9]{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})" /></label>
      <label className="space-y-1 text-sm">Мінімальна важливість<select className="h-9 w-full rounded-md border bg-background px-3" value={values.minSeverity} onChange={(event) => setValues({ ...values, minSeverity: event.target.value as ChannelInput["minSeverity"] })}>{["info", "warning", "error", "critical"].map((severity) => <option key={severity}>{severity}</option>)}</select></label>
      <div className="flex items-center gap-3 self-end py-2"><Switch id={`${prefix}-enabled`} checked={values.enabled} onCheckedChange={(enabled) => setValues({ ...values, enabled })} /><label htmlFor={`${prefix}-enabled`} className="text-sm">Сповіщення увімкнено</label></div>
    </div>
    <fieldset><legend className="mb-2 text-sm">Джерела · порожній вибір означає всі</legend><div className="flex flex-wrap gap-4">{["marstek", "freelancehunt", "system"].map((source) => <label key={source} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.sources.includes(source)} onChange={(event) => setValues({ ...values, sources: event.target.checked ? [...values.sources, source] : values.sources.filter((s) => s !== source) })} />{source}</label>)}</div></fieldset>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Обробка…" : "Зберегти"}</Button>{channel && <><Button type="button" variant="outline" disabled={busy || !channel.enabled} onClick={() => void action("test")}>Тестове сповіщення</Button><Button type="button" variant="ghost" disabled={busy || !channel.enabled} onClick={() => void action("disable")}>Вимкнути</Button></>}</div>
    {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
  </form>;
}
