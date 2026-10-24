import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BatteryFull, Check, Clock3, Database, History, Radio, Send, TriangleAlert } from "lucide-react";
import { getSystemStatus } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { formatDate } from "@/lib/dates";
import { HelpText } from "@/components/help-text";
import { RefreshButton } from "../dashboard/refresh-button";

const names: Record<string, string> = { worker: "Фоновий worker", freelancehunt: "Freelancehunt", "freelancehunt.projects": "Пошук проєктів", "freelancehunt.threads": "Повідомлення" };
const codes: Record<string, string> = { disabled: "Моніторинг вимкнено", not_configured: "Потрібен API-токен", partial_failure: "Помилка інтеграції", failed: "Помилка перевірки" };

function StatusBadge({ tone, children }: { tone: "ok" | "warning" | "muted"; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone === "ok" ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300" : tone === "warning" ? "border-amber-400/15 bg-amber-400/10 text-amber-200" : "border-border bg-muted/50 text-muted-foreground"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{children}</span>;
}
function IconBox({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">{children}</span>;
}

export default async function StatusPage() {
  const user = await currentUser(); if (!user) redirect("/login");
  const status = await getSystemStatus(), now = Date.parse(status.checkedAt);
  return <>
    <section className="grid gap-4 md:grid-cols-3" aria-label="Загальний стан">
      <article className="status-card"><div className="flex items-center justify-between gap-3"><IconBox><Database className="size-5" /></IconBox><StatusBadge tone="ok">Доступний</StatusBadge></div><h2 className="mt-5 text-sm text-muted-foreground">PostgreSQL</h2><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{(status.databaseBytes / 1024 ** 2).toFixed(1)} <span className="text-base font-normal text-muted-foreground">MB</span></p><p className="mt-3 text-xs text-muted-foreground"><HelpText>Розмір БД</HelpText></p></article>
      <article className="status-card"><div className="flex items-center justify-between gap-3"><IconBox><Send className="size-5" /></IconBox><StatusBadge tone={status.failed ? "warning" : "ok"}>{status.failed ? "Потребує уваги" : "Без помилок"}</StatusBadge></div><h2 className="mt-5 text-sm text-muted-foreground">Telegram-доставки</h2><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{status.pending}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><HelpText>Очікують доставки</HelpText></span><span><HelpText>Невдалі</HelpText>: {status.failed}</span></div><Link href="/settings/notifications#delivery-history" className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-primary hover:underline">Історія доставки →</Link></article>
      <article className="status-card"><div className="flex items-center justify-between gap-3"><IconBox><History className="size-5" /></IconBox><span className="text-xs text-muted-foreground">Хвилинні підсумки</span></div><h2 className="mt-5 text-sm text-muted-foreground"><HelpText>Історію агреговано до</HelpText></h2><p className="mt-2 break-words text-lg font-semibold leading-7">{status.aggregateBackfillUntil ? formatDate(status.aggregateBackfillUntil) : "Ще немає даних"}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Київ · фонове заповнення історії для швидких графіків.</p></article>
    </section>
    <section className="space-y-4" aria-labelledby="processes-heading"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="processes-heading" className="text-lg font-semibold"><HelpText>Фонові процеси</HelpText></h2><RefreshButton compact /><p className="text-xs text-muted-foreground">Оновлено {formatDate(status.checkedAt)} · Київ</p></div>
      {!status.jobs.length ? <div className="surface-panel text-sm text-muted-foreground">Worker ще не надсилав даних про стан.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{status.jobs.map(job => {
        const name = job.key.replace("health:", ""), fresh = job.lastObservedAt && now - job.lastObservedAt.getTime() < (name === "worker" ? 30000 : 7200000);
        const healthy = job.value === "ok" && fresh, disabled = job.value === "disabled", label = healthy ? "Працює" : job.value === "ok" ? "Дані застаріли" : codes[job.value] ?? "Помилка перевірки";
        return <article key={job.key} className="status-card"><div className="flex items-start justify-between gap-2"><span aria-hidden="true" className={healthy ? "text-emerald-300" : disabled ? "text-muted-foreground" : "text-amber-300"}>{healthy ? <Check className="size-5" /> : disabled ? <Clock3 className="size-5" /> : <TriangleAlert className="size-5" />}</span><StatusBadge tone={healthy ? "ok" : disabled ? "muted" : "warning"}>{healthy ? "Працює" : disabled ? "Вимкнено" : "Увага"}</StatusBadge></div><h3 className="mt-4 break-words font-semibold">{names[name] ?? name}</h3>{!healthy && <p className="mt-1 text-sm text-muted-foreground">{label}</p>}<dl className="mt-4 space-y-3 border-t pt-4 text-xs"><div><dt className="text-muted-foreground">Остання перевірка</dt><dd className="mt-1 font-medium">{formatDate(job.lastObservedAt)}</dd></div><div><dt className="text-muted-foreground">Успішна перевірка</dt><dd className="mt-1 font-medium">{formatDate(job.lastEventAt)}</dd></div></dl></article>;
      })}</div>}
    </section>
    <section className="space-y-4" aria-labelledby="devices-heading"><h2 id="devices-heading" className="text-lg font-semibold">Пристрої</h2><div className="grid gap-4 md:grid-cols-2">{!status.devices.length && <div className="surface-panel text-sm text-muted-foreground">Пристрої ще не налаштовані.</div>}{status.devices.map(device => {
      const online = device.enabled && device.lastSeenAt && now - device.lastSeenAt.getTime() < 180000;
      return <article key={device.id} className="status-card"><div className="flex items-start gap-3"><IconBox><BatteryFull className="size-5" /></IconBox><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{device.name}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Radio className="size-3" />Marstek · UDP</p></div><StatusBadge tone={online ? "ok" : device.enabled ? "warning" : "muted"}>{online ? "Доступний" : device.enabled ? "Немає зв’язку" : "Вимкнено"}</StatusBadge></div><div className="mt-5 border-t pt-4"><p className="text-xs text-muted-foreground">Останній вимір · Київ</p><p className="mt-1 text-sm font-medium">{formatDate(device.lastSeenAt)}</p>{device.lastError && <p className="mt-3 break-words rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">{device.lastError}</p>}</div><Link href={`/dashboard?device=${encodeURIComponent(device.id)}`} className="mt-4 inline-flex min-h-9 items-center text-sm font-medium text-primary hover:underline">Відкрити телеметрію →</Link></article>;
    })}</div></section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="size-3.5" />Статус формується з реальних перевірок worker і свіжості вимірювань.</p>
  </>;
}
