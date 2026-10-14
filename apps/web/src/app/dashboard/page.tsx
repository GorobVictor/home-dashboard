import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BatteryCharging, BatteryFull, BatteryWarning, Thermometer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { currentUser } from "@/server/auth/session";
import { getMarstekDashboard, type DashboardRange } from "@/server/marstek/dashboard";
import { LogoutButton } from "./logout-button";
import { DashboardLiveUpdates } from "./live-updates";
import { MarstekCharts } from "./marstek-charts";
import { RefreshButton } from "./refresh-button";

function watts(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value).toLocaleString()} W`;
}

function wattHours(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value).toLocaleString()} Wh`;
}

function statusLabel(flow: string, online: boolean) {
  if (!online) return "Offline";
  return flow === "charging" ? "Charging" : flow === "discharging" ? "Discharging" : flow === "idle" ? "Idle" : "No power data";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ device?: string; range?: string }> }) {
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const hours: DashboardRange = params.range === "7d" ? 168 : 24;
  const dashboard = await getMarstekDashboard(params.device, hours);
  const selected = dashboard.devices.find((device) => device.id === dashboard.selectedDeviceId);
  const latest = dashboard.selected?.latest;
  const chartProps = { points: dashboard.points, energy: dashboard.energy, hours };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8 lg:py-10">
      <DashboardLiveUpdates />
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Home Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Energy overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">Welcome, {user.firstName}. Your batteries at a glance.</p>
        </div>
        <div className="flex items-center gap-2"><RefreshButton /><LogoutButton /></div>
      </header>

      <section aria-label="Fleet summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Connected batteries" value={`${dashboard.overview.onlineDevices} / ${dashboard.overview.totalDevices}`} detail="Online in the last 3 minutes" icon={<Activity className="h-5 w-5" />} />
        <SummaryCard label="Average charge" value={dashboard.overview.averageSoc === null ? "—" : `${Math.round(dashboard.overview.averageSoc)}%`} detail="Across online batteries" icon={<BatteryFull className="h-5 w-5" />} />
        <SummaryCard label="Charging now" value={watts(dashboard.overview.chargingW)} detail="Combined battery input" icon={<BatteryCharging className="h-5 w-5" />} />
        <SummaryCard label="Discharging now" value={watts(dashboard.overview.dischargingW)} detail="Combined battery output" icon={<Zap className="h-5 w-5" />} />
      </section>

      {dashboard.devices.length === 0 ? (
        <Card className="border-dashed"><CardHeader><CardTitle>No batteries configured</CardTitle><CardDescription>Add devices to MARSTEK_DEVICES and start the worker to collect readings.</CardDescription></CardHeader></Card>
      ) : (
        <>
          <section aria-label="Batteries">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Batteries</h2><span className="text-sm text-muted-foreground">Select a device for details</span></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.devices.map((device) => (
                <Link key={device.id} href={`/dashboard?device=${encodeURIComponent(device.id)}&range=${hours === 24 ? "24h" : "7d"}`} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <Card className={`h-full transition-colors group-hover:border-primary/40 ${device.id === dashboard.selectedDeviceId ? "border-primary/50 bg-primary/[0.03]" : ""}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div><CardTitle className="text-lg">{device.name}</CardTitle><CardDescription>{device.id}</CardDescription></div>
                        <Badge variant={device.online ? "default" : "secondary"}>{statusLabel(device.flow, device.online)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end justify-between gap-2"><strong className="text-4xl font-semibold tabular-nums">{device.socPercent === null ? "—" : `${Math.round(device.socPercent)}%`}</strong><span className="text-sm text-muted-foreground">{device.online ? watts(device.batteryPowerW === null ? null : Math.abs(device.batteryPowerW)) : "No live reading"}</span></div>
                      <Progress value={device.socPercent ?? 0} aria-label={`${device.name} charge level`} />
                      <div className="flex justify-between text-xs text-muted-foreground"><span>{device.mode ?? "Mode unavailable"}</span><span>{device.lastSeenAt ? `Last seen ${new Date(device.lastSeenAt).toLocaleTimeString()}` : "Awaiting first reading"}</span></div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {dashboard.selected && (
            <section aria-label="Selected battery details" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm text-muted-foreground">Device details</p><h2 className="text-2xl font-semibold">{dashboard.selected.name}</h2></div>
                <div className="flex rounded-lg border bg-muted/30 p-1 text-sm">
                  <RangeLink deviceId={dashboard.selected.id} range="24h" active={hours === 24}>24 hours</RangeLink>
                  <RangeLink deviceId={dashboard.selected.id} range="7d" active={hours === 168}>7 days</RangeLink>
                </div>
              </div>
              {!dashboard.selected.online && <p role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground"><BatteryWarning className="h-4 w-4" />No recent reading. Historical data remains available.</p>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailCard label="Charged in period" value={wattHours(dashboard.period.chargeWh)} icon={<BatteryCharging className="h-4 w-4" />} />
                <DetailCard label="Discharged in period" value={wattHours(dashboard.period.dischargeWh)} icon={<Zap className="h-4 w-4" />} />
                <DetailCard label="Battery temperature" value={latest?.batteryTemperatureC === null || latest?.batteryTemperatureC === undefined ? "—" : `${latest.batteryTemperatureC.toFixed(1)} °C`} icon={<Thermometer className="h-4 w-4" />} />
                <DetailCard label="Stored energy" value={wattHours(latest?.remainingCapacityWh)} icon={<BatteryFull className="h-4 w-4" />} />
              </div>
              <MarstekCharts {...chartProps} />
              <Card>
                <CardHeader><CardTitle className="text-lg">Device telemetry</CardTitle><CardDescription>Most recent readings from the local Marstek API</CardDescription></CardHeader>
                <CardContent className="grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Grid power" value={watts(latest?.gridPowerW)} />
                  <Metric label="Solar power" value={watts(latest?.pvPowerW)} />
                  <Metric label="Backup output" value={watts(latest?.offgridPowerW)} />
                  <Metric label="Rated capacity" value={wattHours(latest?.ratedCapacityWh)} />
                  <Metric label="Grid imported total" value={wattHours(latest?.gridInputTotalWh)} />
                  <Metric label="Grid exported total" value={wattHours(latest?.gridOutputTotalWh)} />
                  <Metric label="CT meter" value={latest?.ctConnected === null || latest?.ctConnected === undefined ? "—" : latest.ctConnected ? "Connected" : "Disconnected"} />
                  <Metric label="Power reading" value={latest?.powerSource === "derived" ? "Estimated" : latest?.powerSource === "reported" ? "Reported" : "Unavailable"} />
                </CardContent>
              </Card>
              {selected?.lastError && <p className="text-xs text-muted-foreground">Latest poll: {selected.lastError.replaceAll("_", " ")}</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-start justify-between gap-2 pt-6"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</span></CardContent></Card>;
}

function DetailCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <Card><CardContent className="pt-5"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}

function RangeLink({ deviceId, range, active, children }: { deviceId: string; range: "24h" | "7d"; active: boolean; children: React.ReactNode }) {
  return <Link href={`/dashboard?device=${encodeURIComponent(deviceId)}&range=${range}`} aria-current={active ? "page" : undefined} className={`rounded-md px-3 py-1.5 transition-colors ${active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{children}</Link>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b pb-2 sm:block"><span className="text-muted-foreground">{label}</span><strong className="font-medium sm:mt-1 sm:block">{value}</strong></div>;
}
