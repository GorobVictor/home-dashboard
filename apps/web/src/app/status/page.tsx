import { HelpText } from "@/components/help-text";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSystemStatus } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { formatDate } from "@/lib/dates";
import { DashboardLiveUpdates } from "../dashboard/live-updates";
import { PageHeader } from "@/components/page-header";

export default async function StatusPage() {
  const user = await currentUser(); if (!user) redirect("/login");
  const status = await getSystemStatus();
  return <main className="dashboard-shell min-h-screen p-3 sm:p-8"><div className="mx-auto max-w-5xl space-y-4">
    <PageHeader title="Стан системи"><Link href="/dashboard" className="underline">Дашборд</Link></PageHeader><DashboardLiveUpdates userId={user.id} />
    <section className="grid gap-3 sm:grid-cols-3"><p className="rounded-xl border bg-card p-4">PostgreSQL доступний<br /><HelpText>Розмір БД</HelpText>: {(status.databaseBytes / 1024 ** 2).toFixed(1)} MB</p><p className="rounded-xl border bg-card p-4"><HelpText>Очікують доставки</HelpText>: {status.pending}<br /><HelpText>Невдалі</HelpText>: {status.failed}</p><p className="rounded-xl border bg-card p-4"><HelpText>Історію агреговано до</HelpText>:<br />{formatDate(status.aggregateBackfillUntil)} · Київ</p></section>
    <h2 aria-label="Фонові процеси" className="font-semibold"><HelpText>Фонові процеси</HelpText></h2>{!status.jobs.length && <p>Worker ще не надсилав heartbeat.</p>}{status.jobs.map(job => <article key={job.key} className="rounded-xl border bg-card p-4"><h3>{job.key.replace("health:", "")}</h3><p>{job.value === "ok" && job.lastObservedAt && Date.parse(status.checkedAt) - job.lastObservedAt.getTime() < (job.key === "health:worker" ? 30000 : 7200000) ? "Працює" : job.value === "ok" ? "Дані застаріли" : job.value}</p><p className="text-sm text-muted-foreground">Перевірка: {formatDate(job.lastObservedAt)} · Успіх: {formatDate(job.lastEventAt)} · Київ</p></article>)}
    <h2 className="font-semibold">Пристрої</h2>{status.devices.map(device => <article key={device.id} className="rounded-xl border bg-card p-4"><h3>{device.name}</h3><p>{!device.enabled ? "Вимкнено" : device.lastSeenAt && Date.parse(status.checkedAt) - device.lastSeenAt.getTime() < 180000 ? "Доступний" : "Немає свіжих даних"}</p><p className="text-sm text-muted-foreground">Останній вимір: {formatDate(device.lastSeenAt)} · Київ {device.lastError ? `· ${device.lastError}` : ""}</p></article>)}
  </div></main>;
}
