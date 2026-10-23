"use client";

import { HelpText } from "@/components/help-text";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dates";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Activity, BatteryCharging, BatteryFull, BatteryWarning, ChevronDown, Clock3, PlugZap, Sun, Thermometer, UtilityPole, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { getMarstekDashboard } from "@/server/marstek/dashboard";
import { FadeValue } from "./fade-value";
import { EnergyOverview } from "./energy-overview";
import { MarstekCharts } from "./marstek-charts";
import { RangeControls } from "./range-controls";

type Dashboard = Awaited<ReturnType<typeof getMarstekDashboard>>;
type Device = Dashboard["devices"][number];
type Latest = NonNullable<Dashboard["selected"]>["latest"];

const watts = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString("uk-UA")} W`;
const wattHours = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString("uk-UA")} Wh`;

export function EnergyDashboard({ dashboard: initial, rangeQuery }: { dashboard: Dashboard; rangeQuery: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<{ key: string | null; data: Pick<Dashboard, "devices" | "selected" | "overview"> }>();
  const [reserve, setReserve] = useState(20);
  const dashboard = snapshot?.key === initial.selectedDeviceId ? { ...initial, ...snapshot.data } : initial;
  useEffect(() => {
    const controller = new AbortController();
    let busy = false, timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await fetch(`/api/marstek/live?device=${encodeURIComponent(initial.selectedDeviceId ?? "")}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { router.replace("/login"); return; }
        if (response.ok && !controller.signal.aborted) setSnapshot({ key: initial.selectedDeviceId, data: await response.json() });
      } catch { /* The connection status and last-known readings remain visible. */ }
      finally { busy = false; }
    };
    const invalidate = () => { if (!timer) timer = setTimeout(() => { timer = undefined; void load(); }, 1000); };
    const interval = setInterval(() => void load(), 10000);
    window.addEventListener("marstek.measurement.saved", invalidate);
    window.addEventListener("focus", invalidate);
    return () => { controller.abort(); clearInterval(interval); clearTimeout(timer); window.removeEventListener("marstek.measurement.saved", invalidate); window.removeEventListener("focus", invalidate); };
  }, [initial.selectedDeviceId, router]);
  const device = dashboard.devices.find((item) => item.id === dashboard.selectedDeviceId);
  const selected = dashboard.selected;

  if (!device || !selected) {
    return <Card className="border-dashed"><CardHeader><CardTitle>Батареї не налаштовані</CardTitle><CardDescription>Додайте пристрої до серверної конфігурації та запустіть worker.</CardDescription></CardHeader></Card>;
  }

  return <div className="flex min-w-0 flex-col gap-4 sm:gap-8">
    {dashboard.devices.length > 1 && <nav aria-label="Оберіть батарею" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap">
      {dashboard.devices.map((item) => {
        const params = new URLSearchParams(rangeQuery);
        params.set("device", item.id);
        return <Link key={item.id} href={`/dashboard?${params}`} scroll={false} aria-current={item.id === device.id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4 ${item.id === device.id ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-border text-muted-foreground hover:bg-muted"}`}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${item.online ? "bg-emerald-400" : "bg-muted-foreground"}`} />{item.name}
        </Link>;
      })}
    </nav>}

    <EnergyOverview battery={<BatteryOverview device={device} latest={selected.latest} />} flow={<PowerFlow device={device} latest={selected.latest} />} />
    <section className="rounded-xl border bg-card p-4 text-sm space-y-2" aria-label="Оцінка автономності">
      <label className="flex flex-wrap items-center gap-3"><HelpText>Резерв заряду, %</HelpText> <input aria-label="Резерв заряду" type="number" min={0} max={95} value={reserve} onChange={event => setReserve(Math.min(95, Math.max(0, Number(event.target.value))))} className="w-20 rounded border bg-background p-2" /></label>
      <p>До резерву за середнім навантаженням за 5 хв: {selected.online && selected.latest?.remainingCapacityWh != null && device.socPercent != null && device.socPercent > reserve && initial.averageDischargeW != null && initial.averageDischargeW > 0.5 ? `${Math.min(525600, Math.round(selected.latest.remainingCapacityWh * (1 - reserve / device.socPercent) / initial.averageDischargeW * 60)).toLocaleString("uk-UA")} хв` : "—"}</p>
      <p className="text-xs text-muted-foreground">Оцінка за незмінного навантаження. Основний індикатор показує час до повного розряду за поточною потужністю.</p>
    </section>

    {dashboard.devices.length > 1 && <section aria-label="Підсумок батарей" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-xs sm:gap-x-6 sm:px-5 sm:text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground"><Activity className="size-4" />Усі батареї</span>
      <span>{dashboard.overview.onlineDevices} / {dashboard.overview.totalDevices} <span className="text-muted-foreground">доступні</span></span>
      <span>{dashboard.overview.averageSoc == null ? "—" : `${Math.round(dashboard.overview.averageSoc)}%`} <span className="text-muted-foreground">середній заряд</span></span>
      <span className="text-emerald-300">{watts(dashboard.overview.chargingW)} <span className="text-muted-foreground">заряджання</span></span>
      <span className="text-sky-300">{watts(dashboard.overview.dischargingW)} <span className="text-muted-foreground">розряджання</span></span>
    </section>}

    {!selected.online && <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200"><BatteryWarning className="size-4 shrink-0" />Немає свіжих вимірювань. Показано останній відомий стан; історія доступна.</p>}

    <section aria-labelledby="energy-history-heading" className="flex min-w-0 flex-col gap-3 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="energy-history-heading" className="text-base font-semibold tracking-tight sm:text-xl">Історія енергії</h2><p className="mt-1 hidden text-sm text-muted-foreground sm:block">Історія показників {device.name}.</p></div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{dashboard.hours <= 24 ? "Погодинні" : "Добові"} підсумки енергії</span>
      </div>
      <RangeControls deviceId={selected.id} activeHours={dashboard.hours} rangeStart={dashboard.rangeStart} rangeEnd={dashboard.rangeEnd} />
      <MarstekCharts points={dashboard.points} energy={dashboard.energy} hours={dashboard.hours} period={dashboard.period} rangeStart={dashboard.rangeStart} rangeEnd={dashboard.rangeEnd} />
      <EnergyAnalytics dashboard={initial} rangeQuery={rangeQuery} />
    </section>
    <Telemetry latest={selected.latest} />
    {device.lastError && <p className="text-xs text-muted-foreground">Остання перевірка: {device.lastError.replaceAll("_", " ")}</p>}
  </div>;
}

function BatteryOverview({ device, latest }: { device: Device; latest: Latest }) {
  const soc = device.socPercent;
  const dischargeMinutes = device.online && latest?.remainingCapacityWh != null && latest.dischargePowerW != null && latest.dischargePowerW > 0.5
    ? latest.remainingCapacityWh / latest.dischargePowerW * 60 : null;
  const estimate = dischargeMinutes != null && Number.isFinite(dischargeMinutes) && dischargeMinutes >= 0 && dischargeMinutes <= 365 * 24 * 60 ? Math.round(dischargeMinutes) : null;
  const state = !device.online ? "Недоступний" : device.flow === "charging" ? "Заряджання" : device.flow === "discharging" ? "Розряджання" : device.flow === "idle" ? "Очікування" : "Немає даних";
  const stateColor = !device.online || device.flow === "unknown" ? "text-muted-foreground bg-muted" : device.flow === "charging" ? "text-emerald-300 bg-emerald-400/10" : device.flow === "discharging" ? "text-sky-300 bg-sky-400/10" : "text-muted-foreground bg-muted";
  const duration = estimate == null ? "Оцінка недоступна" : `${Math.floor(estimate / 1440)} днів ${Math.floor(estimate % 1440 / 60)} годин ${estimate % 60} хвилин`;

  return <Card className="energy-battery-card min-w-0 gap-3 rounded-2xl [--card-spacing:--spacing(3)] sm:gap-6 sm:[--card-spacing:--spacing(6)]">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><p className="energy-eyebrow">Ваша батарея</p><h2 className="mt-1 break-words text-lg font-semibold tracking-tight sm:mt-1.5 sm:text-2xl">{device.name}</h2></div>
        <Badge className={`gap-1.5 border-0 px-2.5 py-1 font-medium ${stateColor}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{state}</Badge>
      </div>
    </CardHeader>
    <CardContent className="grid flex-1 grid-cols-[7rem_minmax(0,1fr)] grid-rows-[1fr_auto] items-center gap-3 sm:block sm:space-y-5">
      <div className="flex items-center justify-center py-1">
        <div className={`energy-charge-ring relative grid size-28 place-items-center rounded-full p-1.5 sm:size-48 sm:p-2 ${!device.online ? "opacity-60" : ""}`} style={{ "--charge": soc == null ? "0%" : `${soc}%` } as CSSProperties}>
          <div className="flex size-full flex-col items-center justify-center rounded-full bg-card">
            <BatteryFull aria-hidden="true" className="mb-1 size-4 text-emerald-300 sm:mb-2 sm:size-5" />
            <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl"><FadeValue value={soc == null ? "—" : `${Math.round(soc)}%`} /></p>
            <p className="mt-1 text-[9px] text-muted-foreground sm:mt-2 sm:text-xs">{device.online ? "Рівень заряду" : "Останній відомий заряд"}</p>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="@container min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5 shrink-0" /><HelpText>Час до розряду</HelpText></p>
          <p className="mt-1 flex h-6 items-baseline gap-1 whitespace-nowrap text-[clamp(0.875rem,11cqi,1.25rem)] font-semibold tabular-nums sm:mt-2 sm:h-7 sm:gap-2" aria-label={duration} title={duration}>
            {estimate == null ? <span className="text-xl">—</span> : <>
              <DurationPart value={Math.floor(estimate / 1440)} unit="д" /><DurationPart value={Math.floor(estimate % 1440 / 60)} unit="г" /><DurationPart value={estimate % 60} unit="хв" />
            </>}
          </p>
          <p className="mt-1 hidden text-[11px] leading-4 text-muted-foreground sm:block">За поточного навантаження</p>
        </div>
        <div className="@container min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BatteryCharging aria-hidden="true" className="size-3.5 shrink-0" /><HelpText>Запас енергії</HelpText></p>
          <p className="mt-1 flex h-6 items-baseline whitespace-nowrap text-[clamp(0.875rem,11cqi,1.25rem)] font-semibold tabular-nums sm:mt-2 sm:h-7"><FadeValue value={wattHours(latest?.remainingCapacityWh)} /></p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">із {wattHours(latest?.ratedCapacityWh)} місткості</p>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:pt-4">
        <span className="inline-flex items-center gap-1.5" title={`Додаткові показники: ${formatDate(latest?.batteryDetailsAt)} · Київ`}><Thermometer aria-hidden="true" className="size-3.5" />{latest?.batteryTemperatureC == null ? "Температура недоступна" : `${latest.batteryTemperatureC.toFixed(1)} °C`}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-1.5 rounded-full ${device.online ? "bg-emerald-400" : "bg-muted-foreground"}`} />{device.online ? "Пристрій доступний" : "Пристрій недоступний"}</span>
      </div>
    </CardContent>
  </Card>;
}

function EnergyAnalytics({ dashboard, rangeQuery }: { dashboard: Dashboard; rangeQuery: string }) {
  const { analytics, previousPeriod, period } = dashboard;
  const query = new URLSearchParams(rangeQuery); if (dashboard.selectedDeviceId) query.set("device", dashboard.selectedDeviceId);
  return <section className="space-y-3 rounded-xl border bg-card p-4 text-sm" aria-label="Аналітика енергії">
    <h3 className="font-semibold">Аналітика періоду</h3>
    <div className="grid gap-3 sm:grid-cols-3"><p><HelpText>Повнота даних</HelpText>: <strong>{analytics.coveragePercent.toFixed(1)}%</strong></p><p><HelpText>Пік заряду</HelpText>: {watts(analytics.chargePeak)}</p><p><HelpText>Пік розряду</HelpText>: {watts(analytics.dischargePeak)}</p></div>
    <p><HelpText>Попередній період</HelpText> · {previousPeriod.completeRange ? "аналогічний" : "доступний"} період: {previousPeriod.available ? `${wattHours(previousPeriod.chargeWh)} заряджено / ${wattHours(previousPeriod.dischargeWh)} віддано` : "немає даних"}. Поточний: {wattHours(dashboard.energy.some(bucket => bucket.chargeWh !== null) ? period.chargeWh : null)} / {wattHours(dashboard.energy.some(bucket => bucket.dischargeWh !== null) ? period.dischargeWh : null)}.</p>
    <details><summary className="cursor-pointer">За днями · Київ</summary><div className="mt-2 max-h-72 overflow-auto"><Table><TableHeader><TableRow><TableHead>День</TableHead><TableHead>Заряд, Wh</TableHead><TableHead>Розряд, Wh</TableHead></TableRow></TableHeader><TableBody>{analytics.days.map(day => <TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{day.known ? Math.round(day.chargeWh) : "—"}</TableCell><TableCell>{day.known ? Math.round(day.dischargeWh) : "—"}</TableCell></TableRow>)}</TableBody></Table></div></details>
    <a className="inline-flex min-h-11 items-center underline" href={`/api/marstek/export?${query}`}>Експорт телеметрії CSV</a>
  </section>;
}

function DurationPart({ value, unit }: { value: number; unit: string }) {
  return <span className="inline-flex items-baseline gap-0.5"><span>{value}</span><span className="text-[0.6em] font-normal text-muted-foreground">{unit}</span></span>;
}

function PowerFlow({ device, latest }: { device: Device; latest: Latest }) {
  const live = device.online;
  const solarActive = live && (latest?.pvPowerW ?? 0) > 0.5;
  const batteryActive = live && device.batteryPowerW != null && Math.abs(device.batteryPowerW) > 0.5;
  const gridActive = live && latest?.gridPowerW != null && Math.abs(latest.gridPowerW) > 0.5;
  const backupActive = live && (latest?.offgridPowerW ?? 0) > 0.5;

  return <Card className="min-w-0 gap-3 rounded-2xl [--card-spacing:--spacing(3)] sm:gap-6 sm:py-6 sm:[--card-spacing:--spacing(6)]">
    <CardHeader><div className="flex items-start justify-between gap-3"><div><h2 aria-label="Потоки енергії" className="text-lg font-semibold"><HelpText>Потоки енергії</HelpText></h2><CardDescription className="mt-1">{live ? "Поточна потужність" : "Останні відомі показники"}</CardDescription></div><span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs ${live ? "text-emerald-300" : "text-muted-foreground"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{live ? "Наживо" : "Недоступний"}</span></div></CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between">
      <div className="energy-flow-map relative mx-auto grid w-full max-w-lg grid-cols-3 grid-rows-[72px_80px_72px] items-center justify-items-center sm:grid-rows-[100px_104px_100px]" aria-label="Поточні показники потужності">
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 600 304" preserveAspectRatio="none" aria-hidden="true">
          <path d="M300 50 V254 M100 152 H500" fill="none" stroke="var(--border)" strokeWidth="1.5" />
          <path className={solarActive ? "energy-flow-active" : ""} d="M300 64 V130" fill="none" stroke="var(--chart-3)" strokeWidth="2" opacity={solarActive ? 0.8 : 0.15} />
          <path className={gridActive ? "energy-flow-active" : ""} d={latest?.gridPowerW != null && latest.gridPowerW > 0 ? "M276 152 H120" : "M120 152 H276"} fill="none" stroke="var(--chart-4)" strokeWidth="2" opacity={gridActive ? 0.8 : 0.15} />
          <path className={backupActive ? "energy-flow-active" : ""} d="M324 152 H480" fill="none" stroke="var(--chart-5)" strokeWidth="2" opacity={backupActive ? 0.8 : 0.15} />
          <path className={batteryActive ? "energy-flow-active" : ""} d={device.batteryPowerW != null && device.batteryPowerW > 0 ? "M300 176 V240" : "M300 240 V176"} fill="none" stroke="var(--chart-1)" strokeWidth="2" opacity={batteryActive ? 0.8 : 0.15} />
        </svg>
        <FlowNode className="col-start-2 row-start-1" label="Сонце" value={watts(latest?.pvPowerW)} icon={<Sun className="size-5" />} color="text-amber-300" active={solarActive} />
        <FlowNode className="col-start-1 row-start-2" label="Мережа" value={watts(latest?.gridPowerW)} icon={<UtilityPole className="size-5" />} color="text-sky-300" active={gridActive} />
        <div className="relative col-start-2 row-start-2 grid size-14 place-items-center rounded-2xl border border-emerald-300/20 bg-card shadow-[0_0_32px_-12px_var(--chart-1)]"><Zap aria-hidden="true" className="size-6 text-emerald-300" /><span className="sr-only">Інвертор</span></div>
        <FlowNode className="col-start-3 row-start-2" label="Резервний вихід" value={watts(latest?.offgridPowerW)} icon={<PlugZap className="size-5" />} color="text-violet-300" active={backupActive} />
        <FlowNode className="col-start-2 row-start-3" label="Батарея" value={watts(device.batteryPowerW == null ? null : Math.abs(device.batteryPowerW))} icon={<BatteryFull className="size-5" />} color="text-emerald-300" active={batteryActive} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground sm:mt-4 sm:pt-4 sm:text-xs"><span>Миттєва потужність · W</span><span>{latest?.powerSource === "derived" ? "Потужність батареї розрахована" : latest?.powerSource === "reported" ? "Потужність батареї виміряна" : "Потужність батареї невідома"}</span></div>
    </CardContent>
  </Card>;
}

function FlowNode({ label, value, icon, color, active, className }: { label: string; value: string; icon: ReactNode; color: string; active: boolean; className: string }) {
  return <div className={`relative z-10 flex w-full min-w-0 flex-col items-center bg-card py-2 ${className}`}>
    <div aria-hidden="true" className={`mb-1 flex size-7 items-center justify-center rounded-full border [&>svg]:size-4 sm:mb-1.5 sm:size-9 sm:[&>svg]:size-5 ${active ? `${color} border-current/30 bg-current/5` : "border-border text-muted-foreground"}`}>{icon}</div>
    <p className="whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base"><FadeValue value={value} /></p>
    <p className="mt-0.5 text-[11px] text-muted-foreground"><HelpText>{label}</HelpText></p>
  </div>;
}

function Telemetry({ latest }: { latest: Latest }) {
  const rows = [["Поточний розряд", watts(latest?.dischargePowerW)], ["Потужність мережі", watts(latest?.gridPowerW)], ["Сонячна потужність", watts(latest?.pvPowerW)], ["Резервний вихід", watts(latest?.offgridPowerW)], ["Потужність CT-лічильника", watts(latest?.meterPowerW)], ["Номінальна місткість", wattHours(latest?.ratedCapacityWh)], ["Отримано з мережі", wattHours(latest?.gridInputTotalWh)], ["Віддано в мережу", wattHours(latest?.gridOutputTotalWh)], ["Вироблено сонцем", wattHours(latest?.pvTotalWh)], ["Спожито навантаженням", wattHours(latest?.loadTotalWh)], ["CT-лічильник", latest?.ctConnected == null ? "—" : latest.ctConnected ? "Під’єднано" : "Від’єднано"], ["Заряджання дозволене", latest?.chargeAllowed == null ? "—" : latest.chargeAllowed ? "Так" : "Ні"], ["Розряджання дозволене", latest?.dischargeAllowed == null ? "—" : latest.dischargeAllowed ? "Так" : "Ні"], ["Джерело потужності", latest?.powerSource === "derived" ? "Розраховано" : latest?.powerSource === "reported" ? "Виміряно" : "Немає даних"]] as const;
  return <details className="group rounded-2xl border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden"><div><h2 className="text-sm font-medium">Телеметрія пристрою</h2><p className="mt-1 text-xs text-muted-foreground">Технічні показники та накопичена енергія</p></div><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
    <div className="border-t px-3 pb-3 sm:px-5 sm:pb-4"><Table><TableHeader><TableRow><TableHead>Показник</TableHead><TableHead className="text-right">Значення</TableHead></TableRow></TableHeader><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableCell><HelpText>{label}</HelpText></TableCell><TableCell className="text-right font-medium tabular-nums">{value}</TableCell></TableRow>)}</TableBody></Table></div>
  </details>;
}
