import Link from "next/link";
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

const watts = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString()} W`;
const wattHours = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString()} Wh`;

export function EnergyDashboard({ dashboard, rangeQuery }: { dashboard: Dashboard; rangeQuery: string }) {
  const device = dashboard.devices.find((item) => item.id === dashboard.selectedDeviceId);
  const selected = dashboard.selected;

  if (!device || !selected) {
    return <Card className="border-dashed"><CardHeader><CardTitle>No batteries configured</CardTitle><CardDescription>Add devices to MARSTEK_DEVICES and start the worker to collect readings.</CardDescription></CardHeader></Card>;
  }

  return <div className="flex min-w-0 flex-col gap-4 sm:gap-8">
    {dashboard.devices.length > 1 && <nav aria-label="Select battery" className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap">
      {dashboard.devices.map((item) => {
        const params = new URLSearchParams(rangeQuery);
        params.set("device", item.id);
        return <Link key={item.id} href={`/dashboard?${params}`} scroll={false} aria-current={item.id === device.id ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4 ${item.id === device.id ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-border text-muted-foreground hover:bg-muted"}`}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${item.online ? "bg-emerald-400" : "bg-muted-foreground"}`} />{item.name}
        </Link>;
      })}
    </nav>}

    <EnergyOverview battery={<BatteryOverview device={device} latest={selected.latest} />} flow={<PowerFlow device={device} latest={selected.latest} />} />

    {dashboard.devices.length > 1 && <section aria-label="All batteries summary" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card/50 px-3 py-3 text-xs sm:gap-x-6 sm:px-5 sm:text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground"><Activity className="size-4" />All batteries</span>
      <span>{dashboard.overview.onlineDevices} / {dashboard.overview.totalDevices} <span className="text-muted-foreground">online</span></span>
      <span>{dashboard.overview.averageSoc == null ? "—" : `${Math.round(dashboard.overview.averageSoc)}%`} <span className="text-muted-foreground">average charge</span></span>
      <span className="text-emerald-300">{watts(dashboard.overview.chargingW)} <span className="text-muted-foreground">charging</span></span>
      <span className="text-sky-300">{watts(dashboard.overview.dischargingW)} <span className="text-muted-foreground">discharging</span></span>
    </section>}

    {!selected.online && <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200"><BatteryWarning className="size-4 shrink-0" />No recent reading. Showing the last known battery state; historical data remains available.</p>}

    <section aria-labelledby="energy-history-heading" className="flex min-w-0 flex-col gap-3 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="energy-history-heading" className="text-base font-semibold tracking-tight sm:text-xl">Energy history</h2><p className="mt-1 hidden text-sm text-muted-foreground sm:block">A closer look at {device.name} over time.</p></div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{dashboard.hours <= 24 ? "Hourly" : "Daily"} energy totals</span>
      </div>
      <RangeControls deviceId={selected.id} activeHours={dashboard.hours} rangeStart={dashboard.rangeStart} rangeEnd={dashboard.rangeEnd} />
      <MarstekCharts points={dashboard.points} energy={dashboard.energy} hours={dashboard.hours} period={dashboard.period} rangeStart={dashboard.rangeStart} rangeEnd={dashboard.rangeEnd} />
    </section>
    <Telemetry latest={selected.latest} />
    {device.lastError && <p className="text-xs text-muted-foreground">Latest poll: {device.lastError.replaceAll("_", " ")}</p>}
  </div>;
}

function BatteryOverview({ device, latest }: { device: Device; latest: Latest }) {
  const soc = device.socPercent;
  const dischargeMinutes = device.online && latest?.remainingCapacityWh != null && latest.dischargePowerW > 0.5
    ? latest.remainingCapacityWh / latest.dischargePowerW * 60 : null;
  const estimate = dischargeMinutes != null && Number.isFinite(dischargeMinutes) && dischargeMinutes >= 0 && dischargeMinutes <= 365 * 24 * 60 ? Math.round(dischargeMinutes) : null;
  const state = !device.online ? "Offline" : device.flow === "charging" ? "Charging" : device.flow === "discharging" ? "Discharging" : device.flow === "idle" ? "Standby" : "Unavailable";
  const stateColor = !device.online || device.flow === "unknown" ? "text-muted-foreground bg-muted" : device.flow === "charging" ? "text-emerald-300 bg-emerald-400/10" : device.flow === "discharging" ? "text-sky-300 bg-sky-400/10" : "text-muted-foreground bg-muted";
  const duration = estimate == null ? "Estimate unavailable" : `${Math.floor(estimate / 1440)} days ${Math.floor(estimate % 1440 / 60)} hours ${estimate % 60} minutes`;

  return <Card className="energy-battery-card min-w-0 gap-3 rounded-2xl [--card-spacing:--spacing(3)] sm:gap-6 sm:[--card-spacing:--spacing(6)]">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><p className="energy-eyebrow">Your battery</p><h2 className="mt-1 break-words text-lg font-semibold tracking-tight sm:mt-1.5 sm:text-2xl">{device.name}</h2></div>
        <Badge className={`gap-1.5 border-0 px-2.5 py-1 font-medium ${stateColor}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{state}</Badge>
      </div>
    </CardHeader>
    <CardContent className="grid flex-1 grid-cols-[7rem_minmax(0,1fr)] grid-rows-[1fr_auto] items-center gap-3 sm:block sm:space-y-5">
      <div className="flex items-center justify-center py-1">
        <div className={`energy-charge-ring relative grid size-28 place-items-center rounded-full p-1.5 sm:size-48 sm:p-2 ${!device.online ? "opacity-60" : ""}`} style={{ "--charge": soc == null ? "0%" : `${soc}%` } as CSSProperties}>
          <div className="flex size-full flex-col items-center justify-center rounded-full bg-card">
            <BatteryFull aria-hidden="true" className="mb-1 size-4 text-emerald-300 sm:mb-2 sm:size-5" />
            <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums sm:text-5xl"><FadeValue value={soc == null ? "—" : `${Math.round(soc)}%`} /></p>
            <p className="mt-1 text-[9px] text-muted-foreground sm:mt-2 sm:text-xs">{device.online ? "Battery level" : "Last known level"}</p>
          </div>
        </div>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="@container min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5 shrink-0" />Time to empty</p>
          <p className="mt-1 flex h-6 items-baseline gap-1 whitespace-nowrap text-[clamp(0.875rem,11cqi,1.25rem)] font-semibold tabular-nums sm:mt-2 sm:h-7 sm:gap-2" aria-label={duration} title={duration}>
            {estimate == null ? <span className="text-xl">—</span> : <>
              <DurationPart value={Math.floor(estimate / 1440)} unit="d" /><DurationPart value={Math.floor(estimate % 1440 / 60)} unit="h" /><DurationPart value={estimate % 60} unit="m" />
            </>}
          </p>
          <p className="mt-1 hidden text-[11px] leading-4 text-muted-foreground sm:block">At current discharge</p>
        </div>
        <div className="@container min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BatteryCharging aria-hidden="true" className="size-3.5 shrink-0" />Stored energy</p>
          <p className="mt-1 flex h-6 items-baseline whitespace-nowrap text-[clamp(0.875rem,11cqi,1.25rem)] font-semibold tabular-nums sm:mt-2 sm:h-7"><FadeValue value={wattHours(latest?.remainingCapacityWh)} /></p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">of {wattHours(latest?.ratedCapacityWh)} capacity</p>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:pt-4">
        <span className="inline-flex items-center gap-1.5"><Thermometer aria-hidden="true" className="size-3.5" />{latest?.batteryTemperatureC == null ? "Temperature unavailable" : `${latest.batteryTemperatureC.toFixed(1)} °C`}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-1.5 rounded-full ${device.online ? "bg-emerald-400" : "bg-muted-foreground"}`} />{device.online ? "Device online" : "Device offline"}</span>
      </div>
    </CardContent>
  </Card>;
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
    <CardHeader><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Energy flow</h2><CardDescription className="mt-1">{live ? "Power at a glance" : "Last known readings"}</CardDescription></div><span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 text-xs ${live ? "text-emerald-300" : "text-muted-foreground"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{live ? "Live" : "Offline"}</span></div></CardHeader>
    <CardContent className="flex flex-1 flex-col justify-between">
      <div className="energy-flow-map relative mx-auto grid w-full max-w-lg grid-cols-3 grid-rows-[72px_80px_72px] items-center justify-items-center sm:grid-rows-[100px_104px_100px]" aria-label="Current device power readings">
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 600 304" preserveAspectRatio="none" aria-hidden="true">
          <path d="M300 50 V254 M100 152 H500" fill="none" stroke="var(--border)" strokeWidth="1.5" />
          <path className={solarActive ? "energy-flow-active" : ""} d="M300 64 V130" fill="none" stroke="var(--chart-3)" strokeWidth="2" opacity={solarActive ? 0.8 : 0.15} />
          <path className={gridActive ? "energy-flow-active" : ""} d={latest?.gridPowerW != null && latest.gridPowerW > 0 ? "M276 152 H120" : "M120 152 H276"} fill="none" stroke="var(--chart-4)" strokeWidth="2" opacity={gridActive ? 0.8 : 0.15} />
          <path className={backupActive ? "energy-flow-active" : ""} d="M324 152 H480" fill="none" stroke="var(--chart-5)" strokeWidth="2" opacity={backupActive ? 0.8 : 0.15} />
          <path className={batteryActive ? "energy-flow-active" : ""} d={device.batteryPowerW != null && device.batteryPowerW > 0 ? "M300 176 V240" : "M300 240 V176"} fill="none" stroke="var(--chart-1)" strokeWidth="2" opacity={batteryActive ? 0.8 : 0.15} />
        </svg>
        <FlowNode className="col-start-2 row-start-1" label="Solar" value={watts(latest?.pvPowerW)} icon={<Sun className="size-5" />} color="text-amber-300" active={solarActive} />
        <FlowNode className="col-start-1 row-start-2" label="Grid" value={watts(latest?.gridPowerW)} icon={<UtilityPole className="size-5" />} color="text-sky-300" active={gridActive} />
        <div className="relative col-start-2 row-start-2 grid size-14 place-items-center rounded-2xl border border-emerald-300/20 bg-card shadow-[0_0_32px_-12px_var(--chart-1)]"><Zap aria-hidden="true" className="size-6 text-emerald-300" /><span className="sr-only">Inverter</span></div>
        <FlowNode className="col-start-3 row-start-2" label="Backup" value={watts(latest?.offgridPowerW)} icon={<PlugZap className="size-5" />} color="text-violet-300" active={backupActive} />
        <FlowNode className="col-start-2 row-start-3" label="Battery" value={watts(device.batteryPowerW == null ? null : Math.abs(device.batteryPowerW))} icon={<BatteryFull className="size-5" />} color="text-emerald-300" active={batteryActive} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground sm:mt-4 sm:pt-4 sm:text-xs"><span>Instantaneous power · W</span><span>{latest?.powerSource === "derived" ? "Battery power estimated" : latest?.powerSource === "reported" ? "Battery power reported" : "Battery power unavailable"}</span></div>
    </CardContent>
  </Card>;
}

function FlowNode({ label, value, icon, color, active, className }: { label: string; value: string; icon: ReactNode; color: string; active: boolean; className: string }) {
  return <div className={`relative z-10 flex w-full min-w-0 flex-col items-center bg-card py-2 ${className}`}>
    <div aria-hidden="true" className={`mb-1 flex size-7 items-center justify-center rounded-full border [&>svg]:size-4 sm:mb-1.5 sm:size-9 sm:[&>svg]:size-5 ${active ? `${color} border-current/30 bg-current/5` : "border-border text-muted-foreground"}`}>{icon}</div>
    <p className="whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base"><FadeValue value={value} /></p>
    <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
  </div>;
}

function Telemetry({ latest }: { latest: Latest }) {
  const rows = [["Current discharge", watts(latest?.dischargePowerW)], ["Grid power", watts(latest?.gridPowerW)], ["Solar power", watts(latest?.pvPowerW)], ["Backup output", watts(latest?.offgridPowerW)], ["CT meter power", watts(latest?.meterPowerW)], ["Rated capacity", wattHours(latest?.ratedCapacityWh)], ["Grid imported total", wattHours(latest?.gridInputTotalWh)], ["Grid exported total", wattHours(latest?.gridOutputTotalWh)], ["Solar generated total", wattHours(latest?.pvTotalWh)], ["Load consumed total", wattHours(latest?.loadTotalWh)], ["CT meter", latest?.ctConnected == null ? "—" : latest.ctConnected ? "Connected" : "Disconnected"], ["Charging allowed", latest?.chargeAllowed == null ? "—" : latest.chargeAllowed ? "Yes" : "No"], ["Discharging allowed", latest?.dischargeAllowed == null ? "—" : latest.dischargeAllowed ? "Yes" : "No"], ["Power reading", latest?.powerSource === "derived" ? "Estimated" : latest?.powerSource === "reported" ? "Reported" : "Unavailable"]] as const;
  return <details className="group rounded-2xl border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden"><div><h2 className="text-sm font-medium">Device telemetry</h2><p className="mt-1 text-xs text-muted-foreground">Technical readings and lifetime energy totals</p></div><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
    <div className="border-t px-3 pb-3 sm:px-5 sm:pb-4"><Table><TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-right font-medium tabular-nums">{value}</TableCell></TableRow>)}</TableBody></Table></div>
  </details>;
}
