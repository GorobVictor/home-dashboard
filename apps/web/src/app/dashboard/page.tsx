import Link from "next/link";
import { redirect } from "next/navigation";
import { listFreelancehuntProjects } from "@home-dashboard/database";
import { Activity, BatteryCharging, BatteryFull, BatteryWarning, Settings, Thermometer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentUser } from "@/server/auth/session";
import { getMarstekDashboard, type DashboardRange } from "@/server/marstek/dashboard";
import { LogoutButton } from "./logout-button";
import { DashboardLiveUpdates } from "./live-updates";
import { MarstekCharts } from "./marstek-charts";
import { FreelancehuntProjects } from "./freelancehunt-projects";
import { RangeControls } from "./range-controls";
import { FadeValue } from "./fade-value";

const validRanges = new Set<DashboardRange>([1, 6, 24, 168, 720]);
const watts = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString()} W`;
const wattHours = (value: number | null | undefined) => value == null ? "—" : `${Math.round(value).toLocaleString()} Wh`;

function parseCustomRange(fromValue?: string, toValue?: string) {
  if (!fromValue || !toValue || !/^\d{4}-\d{2}-\d{2}$/.test(fromValue) || !/^\d{4}-\d{2}-\d{2}$/.test(toValue)) return undefined;
  const from = new Date(`${fromValue}T00:00:00.000Z`), to = new Date(`${toValue}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 90 * 864e5 || to > new Date()) return undefined;
  return { from, to };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ device?: string; range?: string; from?: string; to?: string; tab?: string; page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const params = await searchParams, custom = parseCustomRange(params.from, params.to), requested = Number(params.range), requestedPage = Number(params.page);
  const range: DashboardRange = validRanges.has(requested as DashboardRange) ? requested as DashboardRange : 24;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [dashboard, projectPage] = await Promise.all([getMarstekDashboard(params.device, range, custom?.from, custom?.to), listFreelancehuntProjects(page)]);
  const freelancehunt = params.tab === "freelancehunt";
  return <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-7 px-3 py-5 sm:px-8 sm:py-8 lg:py-10"><DashboardLiveUpdates />
    <header className="flex flex-wrap items-start justify-between gap-4 sm:items-center sm:gap-5"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-sm">Home Dashboard</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1><p className="mt-2 text-sm text-muted-foreground">Welcome, {user.firstName}.</p></div><div className="flex items-center gap-2"><Link href="/settings" className="inline-flex size-9 items-center justify-center rounded-lg border hover:bg-muted" aria-label="Settings"><Settings className="size-4" /></Link><LogoutButton /></div></header>
    <nav className="w-full overflow-x-auto rounded-lg border bg-muted/30 p-1 sm:w-fit" aria-label="Dashboard sections"><div className="flex min-w-max"><TabLink active={!freelancehunt} href="/dashboard">Energy</TabLink><TabLink active={freelancehunt} href="/dashboard?tab=freelancehunt">Freelancehunt <Badge variant="secondary" className="ml-1">{projectPage.total}</Badge></TabLink></div></nav>
    {freelancehunt ? <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">Freelancehunt projects</h2><p className="text-sm text-muted-foreground">{projectPage.total} projects · select one to read its full description.</p></div><Link className="text-sm font-medium text-primary hover:underline" href="/settings">Configure filters</Link></div><FreelancehuntProjects projects={projectPage.projects.map((project) => ({ ...project, discoveredAt: project.discoveredAt.toISOString() }))} /><ProjectPagination page={projectPage.page} pageSize={projectPage.pageSize} total={projectPage.total} /></section> : <Energy dashboard={dashboard} />}
  </main>;
}

function Energy({ dashboard }: { dashboard: Awaited<ReturnType<typeof getMarstekDashboard>> }) {
  const selected = dashboard.devices.find((device) => device.id === dashboard.selectedDeviceId), latest = dashboard.selected?.latest;
  const dischargeMinutes = latest?.remainingCapacityWh != null && latest.dischargePowerW > 0.5
    ? latest.remainingCapacityWh / latest.dischargePowerW * 60
    : null;
  const estimatedTimeToEmpty = dischargeMinutes !== null && Number.isFinite(dischargeMinutes) && dischargeMinutes >= 0 && dischargeMinutes <= 365 * 24 * 60
    ? formatDuration(dischargeMinutes)
    : "—";
  return <><section aria-label="Fleet summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Summary label="Connected batteries" value={`${dashboard.overview.onlineDevices} / ${dashboard.overview.totalDevices}`} detail="Online in the last 3 minutes" icon={<Activity className="h-5 w-5" />} /><Summary label="Average charge" value={dashboard.overview.averageSoc == null ? "—" : `${Math.round(dashboard.overview.averageSoc)}%`} detail="Across online batteries" icon={<BatteryFull className="h-5 w-5" />} /><Summary label="Charging now" value={watts(dashboard.overview.chargingW)} detail="Combined battery input" icon={<BatteryCharging className="h-5 w-5" />} /><Summary label="Discharging now" value={watts(dashboard.overview.dischargingW)} detail="Combined battery output" icon={<Zap className="h-5 w-5" />} /><Summary label="Time to empty" value={estimatedTimeToEmpty} detail={dashboard.selected ? `${dashboard.selected.name} at current discharge` : "Select a battery"} icon={<BatteryWarning className="h-5 w-5" />} /></section>
    {dashboard.devices.length === 0 ? <Card className="border-dashed"><CardHeader><CardTitle>No batteries configured</CardTitle><CardDescription>Add devices to MARSTEK_DEVICES and start the worker to collect readings.</CardDescription></CardHeader></Card> : <><section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Batteries</h2><span className="text-sm text-muted-foreground">Select a device for details</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboard.devices.map((device) => <Link key={device.id} href={`/dashboard?device=${encodeURIComponent(device.id)}`} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Card className={`h-full transition-colors group-hover:border-primary/40 ${device.id === dashboard.selectedDeviceId ? "border-primary/50 bg-primary/[0.03]" : ""}`}><CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{device.name}</CardTitle><CardDescription>{device.id}</CardDescription></div><Badge variant={device.online ? "default" : "secondary"}>{device.online ? device.flow : "Offline"}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="flex items-end justify-between gap-2"><strong className="text-4xl font-semibold tabular-nums">{device.socPercent == null ? "—" : `${Math.round(device.socPercent)}%`}</strong><span className="text-sm text-muted-foreground">{device.online ? watts(device.batteryPowerW == null ? null : Math.abs(device.batteryPowerW)) : "No live reading"}</span></div><Progress value={device.socPercent ?? 0} aria-label={`${device.name} charge level`} /></CardContent></Card></Link>)}</div></section>
      {dashboard.selected && <section className="space-y-4"><div className="space-y-3"><div><p className="text-sm text-muted-foreground">Device details</p><h2 className="text-2xl font-semibold">{dashboard.selected.name}</h2></div><RangeControls deviceId={dashboard.selected.id} activeHours={dashboard.hours} rangeStart={dashboard.rangeStart} rangeEnd={dashboard.rangeEnd} /></div>{!dashboard.selected.online && <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground"><BatteryWarning className="h-4 w-4" />No recent reading. Historical data remains available.</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Detail label="Charged in period" value={wattHours(dashboard.period.chargeWh)} icon={<BatteryCharging className="h-4 w-4" />} /><Detail label="Discharged in period" value={wattHours(dashboard.period.dischargeWh)} icon={<Zap className="h-4 w-4" />} /><Detail label="Battery temperature" value={latest?.batteryTemperatureC == null ? "—" : `${latest.batteryTemperatureC.toFixed(1)} °C`} icon={<Thermometer className="h-4 w-4" />} /><Detail label="Stored energy" value={wattHours(latest?.remainingCapacityWh)} icon={<BatteryFull className="h-4 w-4" />} /><Detail label="Estimated time to empty" value={estimatedTimeToEmpty} icon={<BatteryWarning className="h-4 w-4" />} /></div><MarstekCharts points={dashboard.points} energy={dashboard.energy} hours={dashboard.hours} /><Telemetry latest={latest} />{selected?.lastError && <p className="text-xs text-muted-foreground">Latest poll: {selected.lastError.replaceAll("_", " ")}</p>}</section>}</>}</>;
}

function Telemetry({ latest }: { latest: NonNullable<Awaited<ReturnType<typeof getMarstekDashboard>>["selected"]>["latest"] | undefined }) {
  const dischargeMinutes = latest?.remainingCapacityWh != null && latest.dischargePowerW > 0.5
    ? latest.remainingCapacityWh / latest.dischargePowerW * 60
    : null;
  const timeToEmpty = dischargeMinutes !== null && Number.isFinite(dischargeMinutes) && dischargeMinutes >= 0 && dischargeMinutes <= 365 * 24 * 60
    ? formatDuration(dischargeMinutes)
    : "—";
  const rows = [["Estimated time to empty", timeToEmpty], ["Current discharge", watts(latest?.dischargePowerW)], ["Grid power", watts(latest?.gridPowerW)], ["Solar power", watts(latest?.pvPowerW)], ["Backup output", watts(latest?.offgridPowerW)], ["CT meter power", watts(latest?.meterPowerW)], ["Rated capacity", wattHours(latest?.ratedCapacityWh)], ["Grid imported total", wattHours(latest?.gridInputTotalWh)], ["Grid exported total", wattHours(latest?.gridOutputTotalWh)], ["Solar generated total", wattHours(latest?.pvTotalWh)], ["Load consumed total", wattHours(latest?.loadTotalWh)], ["CT meter", latest?.ctConnected == null ? "—" : latest.ctConnected ? "Connected" : "Disconnected"], ["Charging allowed", latest?.chargeAllowed == null ? "—" : latest.chargeAllowed ? "Yes" : "No"], ["Discharging allowed", latest?.dischargeAllowed == null ? "—" : latest.dischargeAllowed ? "Yes" : "No"], ["Power reading", latest?.powerSource === "derived" ? "Estimated" : latest?.powerSource === "reported" ? "Reported" : "Unavailable"]] as const;
  return <Card><CardHeader><CardTitle className="text-lg">Device telemetry</CardTitle><CardDescription>Most recent readings from the local Marstek API</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader><TableBody>{rows.map(([label, value]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-right font-medium">{value}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}
function formatDuration(minutes: number) {
  const rounded = Math.round(minutes);
  const days = Math.floor(rounded / 1_440), hours = Math.floor(rounded % 1_440 / 60), remainingMinutes = rounded % 60;
  return [days ? `${days}d` : null, hours ? `${hours}h` : null, remainingMinutes ? `${remainingMinutes}m` : null].filter(Boolean).join(" ") || "0m";
}
function ProjectPagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4));
  const visible = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return <nav className="flex flex-wrap items-center justify-center gap-2 pt-2" aria-label="Project pages"><Link className={`rounded-md border px-3 py-1.5 text-sm ${page === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`} href={`/dashboard?tab=freelancehunt&page=${page - 1}`} aria-disabled={page === 1}>Previous</Link>{visible.map((item) => <Link key={item} href={`/dashboard?tab=freelancehunt&page=${item}`} aria-current={item === page ? "page" : undefined} className={`min-w-9 rounded-md border px-3 py-1.5 text-center text-sm ${item === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{item}</Link>)}<Link className={`rounded-md border px-3 py-1.5 text-sm ${page === pages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`} href={`/dashboard?tab=freelancehunt&page=${page + 1}`} aria-disabled={page === pages}>Next</Link></nav>;
}
function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) { return <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{children}</Link>; }
function Summary({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <Card><CardContent className="flex items-start justify-between gap-2 pt-6"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums"><FadeValue value={value} /></p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</span></CardContent></Card>; }
function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  if (label === "Estimated time to empty") return null;
  return <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-3 text-2xl font-semibold tabular-nums"><FadeValue value={value} /></p></CardContent></Card>;
}
