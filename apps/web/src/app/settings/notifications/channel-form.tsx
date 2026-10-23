"use client";

import { HelpText } from "@/components/help-text";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChannelInput } from "@home-dashboard/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FreelancehuntSelect } from "../../dashboard/freelancehunt-select";
import { severityLabels, sourceLabels, eventTypeLabels } from "@/lib/labels";

const emptyChannel: ChannelInput = { name: "", chatId: "", enabled: true, minSeverity: "info", sources: [], eventTypes: [], deviceIds: [], quietFrom: "", quietTo: "", digest: false };
const newChannel = (): ChannelInput => ({ ...emptyChannel, sources: [] });

export function ChannelForm({ channel, devices = [] }: { channel?: ChannelInput & { id: string }; devices?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [values, setValues] = useState<ChannelInput>(channel ? { name: channel.name, chatId: channel.chatId, enabled: channel.enabled, minSeverity: channel.minSeverity, sources: channel.sources, eventTypes: channel.eventTypes ?? [], deviceIds: channel.deviceIds ?? [], quietFrom: channel.quietFrom ?? "", quietTo: channel.quietTo ?? "", digest: channel.digest ?? false } : newChannel());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState(false);
  const prefix = channel?.id ?? "new";

  async function action(kind: "save" | "test" | "disable") {
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/notification-channels${channel ? `/${channel.id}` : ""}${kind === "test" ? "/test" : ""}`, { method: kind === "test" ? "POST" : kind === "disable" ? "DELETE" : channel ? "PUT" : "POST", headers: { "content-type": "application/json" }, ...(kind === "save" ? { body: JSON.stringify(values) } : {}) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error === "test_rate_limited" ? "Зачекайте 30 секунд перед наступним тестом." : data.error === "channel_already_exists" ? "Канал із таким ID чату вже існує." : data.error === "channel_disabled" ? "Увімкніть і збережіть канал перед тестом." : "Дію не виконано. Перевірте значення та повторіть спробу."); }
      setMessage(kind === "test" ? "Тестове сповіщення очікує доставки. Результат з’явиться в історії." : "Збережено.");
      if (!channel) setValues(newChannel());
      router.refresh();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Запит не вдався."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={(event) => { event.preventDefault(); void action("save"); }} className="min-w-0 space-y-4 rounded-2xl border bg-card p-3 sm:space-y-6 sm:p-6">
    <header><h2 className="break-words text-base font-semibold sm:text-lg">{channel ? channel.name : "Додати Telegram-канал"}</h2><p className="mt-1 text-sm text-muted-foreground">Канал отримує вибрані події з указаною або вищою важливістю.</p></header>
    <section className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-5">
      <label className="grid gap-2 text-sm font-medium"><HelpText>Назва каналу</HelpText><Input aria-label="Назва каналу" className="h-10" required maxLength={100} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
      <label className="grid gap-2 text-sm font-medium"><HelpText>ID чату</HelpText><Input aria-label="ID чату" className="h-10" required maxLength={100} placeholder="-1001234567890 або @channel" value={values.chatId} onChange={(event) => setValues({ ...values, chatId: event.target.value })} pattern="(-?[0-9]{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})" /></label>
      <FreelancehuntSelect label="Мінімальна важливість" value={values.minSeverity} onValueChange={(minSeverity) => setValues({ ...values, minSeverity: minSeverity as ChannelInput["minSeverity"] })} options={["info", "warning", "error", "critical"].map((value) => ({ value, label: severityLabels[value] ?? value }))} />
      <div className="flex min-h-11 items-center gap-3 rounded-lg border bg-input/30 px-3 sm:mt-7 sm:min-h-10"><Switch aria-label="Сповіщення ввімкнено" id={`${prefix}-enabled`} className="data-checked:bg-emerald-400" checked={values.enabled} onCheckedChange={(enabled) => setValues({ ...values, enabled })} /><label htmlFor={`${prefix}-enabled`} className="text-sm font-medium"><HelpText>Сповіщення ввімкнено</HelpText></label></div>
    </section>
    <fieldset className="rounded-xl border bg-muted/20 p-3 sm:p-4"><legend className="px-1 text-sm font-medium"><HelpText>Джерела</HelpText></legend><p className="mb-3 text-xs text-muted-foreground">Не обирайте джерел, щоб отримувати події від усіх.</p><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{["marstek", "freelancehunt", "system"].map((source) => <label key={source} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm transition-colors ${values.sources.includes(source) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-input bg-input/30 text-muted-foreground hover:bg-muted"}`}><Checkbox checked={values.sources.includes(source)} onChange={(event) => setValues({ ...values, sources: event.target.checked ? [...values.sources, source] : values.sources.filter((item) => item !== source) })} />{sourceLabels[source] ?? source}</label>)}</div></fieldset>
    <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2" disabled={busy}><legend className="px-1 text-sm font-medium">Правила доставки</legend>
      <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium"><HelpText>Типи подій</HelpText> · порожньо означає всі</legend><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{Object.entries(eventTypeLabels).map(([value,label]) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox aria-label={label} checked={(values.eventTypes ?? []).includes(value)} onChange={event => setValues({ ...values, eventTypes: event.target.checked ? [...(values.eventTypes ?? []), value] : (values.eventTypes ?? []).filter(type => type !== value) })} /><HelpText>{label}</HelpText></label>)}</div></fieldset>
      <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium"><HelpText>Пристрої</HelpText> · порожньо означає всі</legend><div className="flex flex-wrap gap-3">{devices.map(device => <label key={device.id} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={(values.deviceIds ?? []).includes(device.id)} onChange={event => setValues({ ...values, deviceIds: event.target.checked ? [...(values.deviceIds ?? []), device.id] : (values.deviceIds ?? []).filter(id => id !== device.id) })} />{device.name}</label>)}</div></fieldset>
      <label className="space-y-2 text-sm"><HelpText>Тихі години з · Київ</HelpText><Input aria-label="Тихі години з · Київ" type="time" value={values.quietFrom ?? ""} onChange={event => setValues({ ...values, quietFrom: event.target.value })} /></label><label className="space-y-2 text-sm"><HelpText>До · Київ</HelpText><Input aria-label="До · Київ" type="time" value={values.quietTo ?? ""} onChange={event => setValues({ ...values, quietTo: event.target.value })} /></label>
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><Checkbox aria-label="Добовий підсумок" checked={values.digest ?? false} onChange={event => setValues({ ...values, digest: event.target.checked })} /><span><HelpText>Добовий підсумок</HelpText> · додатково після 09:00 за Києвом</span></label><p className="text-xs text-muted-foreground sm:col-span-2">Окремі події надходять і з увімкненим підсумком. Критичні події надходять одразу, навіть у тихі години. Звичайні повідомлення очікують завершення тихих годин. Збереження правил скасовує старі очікувані доставки.</p>
    </fieldset>
    <p className="text-xs text-muted-foreground"><HelpText>Дії каналу</HelpText></p>
    <footer className="flex flex-wrap items-center gap-2 border-t pt-3 sm:pt-5 [&>button]:flex-1 sm:[&>button]:flex-none"><Button type="submit" disabled={busy} title="Застосувати правила спільного каналу; старі очікувані доставки буде скасовано.">{busy ? "Виконуємо…" : "Зберегти"}</Button>{channel && <><Button type="button" variant="outline" disabled={busy || !channel.enabled} onClick={() => void action("test")} title="Тест обходить фільтри й тихі години. Результат — в історії доставок.">Надіслати тест</Button><Button type="button" variant="ghost" disabled={busy || !channel.enabled} onClick={() => void action("disable")} title="Припинити доставку всім користувачам цього каналу та скасувати очікувані повідомлення.">Вимкнути</Button></>}</footer>
    {message && <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
  </form>;
}
