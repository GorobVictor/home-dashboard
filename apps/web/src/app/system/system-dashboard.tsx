"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, LayoutGrid, List, RefreshCw, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSavedView } from "@/components/use-saved-view";

export type SystemContainer = { id: string; name: string; image: string; state: string; health: string; startedAt: string | null; exitCode: number | null; restartCount: number; lastSeenAt: string | null; metrics: { cpuPercent: number | null; memoryWorkingSetBytes: string | null; memoryLimitBytes: string | null; memoryPercent: number | null; networkRxPerSecond: number | null; networkTxPerSecond: number | null } | null; action: { status: string } | null };
type Settings = { enabled: boolean; pollIntervalSeconds: number; stoppedAlertsEnabled: boolean; unhealthyAlertsEnabled: boolean };
type ContainerView = "cards" | "list";
type ContainerListItem = Omit<SystemContainer, "metrics" | "action"> & { metrics: NonNullable<SystemContainer["metrics"]>[]; actions: NonNullable<SystemContainer["action"]>[] };
const bytes = (value: string | number | null | undefined) => { if (value == null) return "—"; const n = Number(value); if (!Number.isFinite(n)) return "—"; const units = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let x = n; while (x >= 1024 && i < units.length - 1) { x /= 1024; i += 1; } return `${x.toFixed(x >= 100 || i === 0 ? 0 : 1)} ${units[i]}`; };
const rate = (value: number | null | undefined) => value == null ? "—" : `${bytes(value)}/s`;
const uptime = (value: string | null) => { if (!value) return "—"; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60); return `${days ? `${days}d ` : ""}${hours}h ${minutes}m`; };
const stateTone = (state: string, health: string) => health === "unhealthy" ? "destructive" : state === "running" && health !== "starting" ? "default" : "secondary";
const percent = (value: unknown) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
const byteValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? bytes(value) : "—";
const byteRate = (value: unknown) => typeof value === "number" ? `${bytes(value)}/s` : "—";

function MetricsChart({ id }: { id: string }) {
  const [points, setPoints] = useState<Array<{ sampledAt: string; cpuPercent: number | null; memoryWorkingSetBytes: string | null; networkRxPerSecond: number | null; networkTxPerSecond: number | null }>>([]);
  useEffect(() => { let live = true; fetch(`/api/docker/containers/${id}/history?range=24`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []).then((data) => { if (live && Array.isArray(data)) setPoints(data); }).catch(() => undefined); return () => { live = false; }; }, [id]);
  if (!points.length) return <p className="text-sm text-muted-foreground">Historical metrics are still being collected.</p>;
  const chartData = points.map((point) => ({ ...point, networkTotalPerSecond: point.networkRxPerSecond === null && point.networkTxPerSecond === null ? null : (point.networkRxPerSecond ?? 0) + (point.networkTxPerSecond ?? 0) }));
  const charts = [{ name: "CPU", key: "cpuPercent", color: "#60a5fa", format: percent }, { name: "RAM", key: "memoryWorkingSetBytes", color: "#34d399", format: byteValue }, { name: "Network RX + TX", key: "networkTotalPerSecond", color: "#fbbf24", format: byteRate }];
  return <div className="grid min-w-0 gap-5 lg:grid-cols-3">{charts.map(({ name, key, color, format }) => <div key={key} className="min-w-0"><p className="mb-2 text-xs text-muted-foreground">{name}</p><div className="h-40"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="sampledAt" hide /><YAxis width={54} tick={{ fontSize: 10 }} tickFormatter={format} /><Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()} formatter={(value) => format(value)} /><Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.18} connectNulls={false} /></AreaChart></ResponsiveContainer></div></div>)}</div>;
}

function ContainerActions({ container, controlEnabled, chartsOpen, onToggleCharts, onDone }: { container: SystemContainer; controlEnabled: boolean; chartsOpen: boolean; onToggleCharts: () => void; onDone: () => void }) {
  const [working, setWorking] = useState(false); const action = container.state === "running" || container.state === "restarting" ? "stop" : "start";
  const run = async () => { if (action === "stop" && !window.confirm(`Stop ${container.name}? Docker gives the container 10 seconds to exit before it may force termination.`)) return; const confirmationName = container.name.startsWith("home-dashboard-") ? window.prompt(`This is a Home Dashboard component. Enter the full name ${container.name} to confirm.`) : undefined; if (container.name.startsWith("home-dashboard-") && confirmationName !== container.name) return; setWorking(true); try { const response = await fetch(`/api/docker/containers/${container.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(confirmationName ? { confirmationName } : {}) }) }); const result = await response.json(); if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "request_failed"); if (result.status === "noop") { toast.info("The container already has that state."); onDone(); return; } const id = result.actionId as string; for (let i = 0; i < 30; i += 1) { await new Promise((resolve) => setTimeout(resolve, 1000)); const status = await fetch(`/api/docker/actions/${id}`, { cache: "no-store" }).then((r) => r.json()); if (["succeeded", "failed", "unknown"].includes(status.status)) { if (status.status !== "succeeded") throw new Error(status.errorCode ?? status.status); toast.success(action === "start" ? "Container started." : "Container stopped."); onDone(); return; } } toast.warning("The command result is not known yet. Refresh the list."); } catch (error) { toast.error(`Action failed: ${error instanceof Error ? error.message : "unknown_error"}`); } finally { setWorking(false); } };
  return <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Button type="button" variant="outline" aria-expanded={chartsOpen} onClick={onToggleCharts}>{chartsOpen ? "Hide charts" : "Charts"}</Button><Button type="button" disabled={!controlEnabled || working || !["running", "restarting", "created", "exited"].includes(container.state)} variant={action === "stop" ? "destructive" : "default"} onClick={run}>{working ? "Working…" : action === "stop" ? "Stop" : "Start"}</Button></div>;
}

function ContainerCard({ container, controlEnabled, compact = false, onDone }: { container: SystemContainer; controlEnabled: boolean; compact?: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const metric = container.metrics;
  return <Card className="min-w-0">
    <CardHeader className="gap-3">
      <div className="flex flex-wrap gap-1.5"><Badge variant={stateTone(container.state, container.health)}>{container.state}</Badge>{container.health !== "none" && <Badge variant="outline">{container.health}</Badge>}</div>
      <div className="min-w-0"><CardTitle className="text-base leading-6 [overflow-wrap:anywhere]">{container.name}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{container.image}</p></div>
    </CardHeader>
    <CardContent className="flex min-w-0 flex-col gap-4">
      <dl className={`grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm tabular-nums [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:[overflow-wrap:anywhere] ${compact ? "border-y py-3" : "rounded-xl bg-muted/30 p-3"}`}>
        <div><dt>CPU</dt><dd>{metric?.cpuPercent == null ? "—" : `${metric.cpuPercent.toFixed(1)}%`}</dd></div>
        <div><dt>RAM</dt><dd>{bytes(metric?.memoryWorkingSetBytes)}{metric?.memoryLimitBytes ? ` / ${bytes(metric.memoryLimitBytes)}` : ""}</dd></div>
        <div className="col-span-2"><dt>Network RX / TX</dt><dd>{rate(metric?.networkRxPerSecond)} / {rate(metric?.networkTxPerSecond)}</dd></div>
        <div><dt>Uptime</dt><dd>{uptime(container.startedAt)}</dd></div>
        <div><dt>Restarts / exit code</dt><dd>{container.restartCount} / {container.exitCode ?? "—"}</dd></div>
      </dl>
      <ContainerActions container={container} controlEnabled={controlEnabled} chartsOpen={open} onToggleCharts={() => setOpen(!open)} onDone={onDone} />
      {!controlEnabled && <p className="text-xs text-muted-foreground">Controls are disabled in server configuration.</p>}
      {open && <MetricsChart id={container.id} />}
    </CardContent>
  </Card>;
}

function ContainerRow({ container, controlEnabled, onDone }: { container: SystemContainer; controlEnabled: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const metric = container.metrics;
  return <><tr className="border-b align-top last:border-0"><td className="px-4 py-3"><p className="max-w-64 break-all font-medium">{container.name}</p><p className="mt-1 max-w-64 break-all text-xs text-muted-foreground">{container.image}</p></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Badge variant={stateTone(container.state, container.health)}>{container.state}</Badge>{container.health !== "none" && <Badge variant="outline">{container.health}</Badge>}</div></td><td className="px-4 py-3 tabular-nums">{metric?.cpuPercent == null ? "—" : `${metric.cpuPercent.toFixed(1)}%`}</td><td className="px-4 py-3 tabular-nums">{bytes(metric?.memoryWorkingSetBytes)}</td><td className="px-4 py-3 whitespace-nowrap tabular-nums">{rate(metric?.networkRxPerSecond)} / {rate(metric?.networkTxPerSecond)}</td><td className="px-4 py-3 whitespace-nowrap">{uptime(container.startedAt)}</td><td className="px-4 py-3"><ContainerActions container={container} controlEnabled={controlEnabled} chartsOpen={open} onToggleCharts={() => setOpen(!open)} onDone={onDone} />{!controlEnabled && <p className="mt-2 text-xs text-muted-foreground">Controls are disabled.</p>}</td></tr>{open && <tr className="border-b"><td colSpan={7} className="px-4 py-4"><MetricsChart id={container.id} /></td></tr>}</>;
}

function ContainerViewToggle({ view, onChange }: { view: ContainerView; onChange: (view: ContainerView) => void }) {
  return <div className="inline-flex shrink-0 gap-1 rounded-xl border bg-muted/30 p-1" role="group" aria-label="Container view"><Button type="button" size="icon" variant={view === "cards" ? "secondary" : "ghost"} aria-label="Cards" aria-pressed={view === "cards"} onClick={() => onChange("cards")}><LayoutGrid className="size-4" /></Button><Button type="button" size="icon" variant={view === "list" ? "secondary" : "ghost"} aria-label="List" aria-pressed={view === "list"} onClick={() => onChange("list")}><List className="size-4" /></Button></div>;
}

export function SystemDashboard({ initial, settings, controlEnabled }: { initial: SystemContainer[]; settings: Settings; controlEnabled: boolean }) {
  const [containers, setContainers] = useState(initial); const [config, setConfig] = useState(settings); const [query, setQuery] = useState(""); const [saving, setSaving] = useState(false); const [refreshing, setRefreshing] = useState(false); const [view, changeView] = useSavedView("home-dashboard:docker-container-view");
  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/docker/containers?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: { items: ContainerListItem[] } = await response.json();
      setContainers(data.items.map(({ metrics, actions, ...item }) => ({ ...item, metrics: metrics[0] ?? null, action: actions[0] ?? null })));
    } catch { if (manual) toast.error("Could not refresh containers. Try again."); }
    finally { if (manual) setRefreshing(false); }
  }, [query]);
  useEffect(() => { const timer = setInterval(() => void refresh(), 15_000); return () => clearInterval(timer); }, [refresh]);
  const saveSettings = async () => { setSaving(true); try { const response = await fetch("/api/docker/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) }); if (!response.ok) throw new Error(); toast.success("Settings saved."); } catch { toast.error("Could not save settings."); } finally { setSaving(false); } };
  return <div className="flex min-w-0 flex-col gap-5">
    <details className="group rounded-xl border bg-card">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <Settings2 aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">Docker monitoring</h3><p className="mt-1 text-xs text-muted-foreground">{settings.enabled ? `Collecting every ${settings.pollIntervalSeconds}s` : "Collection paused"} · Settings</p></div>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t p-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 text-sm">Collect metrics<Switch checked={config.enabled} onCheckedChange={(enabled) => setConfig({ ...config, enabled })} /></label>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 text-sm">Stopped alert<Switch checked={config.stoppedAlertsEnabled} onCheckedChange={(stoppedAlertsEnabled) => setConfig({ ...config, stoppedAlertsEnabled })} /></label>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 text-sm">Unhealthy alert<Switch checked={config.unhealthyAlertsEnabled} onCheckedChange={(unhealthyAlertsEnabled) => setConfig({ ...config, unhealthyAlertsEnabled })} /></label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 md:col-span-2 xl:col-span-3">
          <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">Interval, seconds<Input className="h-11 sm:max-w-48" type="number" min={5} max={300} value={config.pollIntervalSeconds} onChange={(e) => setConfig({ ...config, pollIntervalSeconds: Number(e.target.value) })} /></label>
          <Button className="min-h-11 px-6" disabled={saving} onClick={saveSettings}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </details>
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap" aria-label="Filter containers">
      <form className="relative col-span-2 flex min-w-0 gap-2 sm:flex-1" onSubmit={(event) => { event.preventDefault(); void refresh(true); }}>
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search containers</span><Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 pl-9" type="search" enterKeyHint="search" maxLength={100} placeholder="Search by name or image" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <Button className="min-h-11 px-3" type="submit" variant="outline" disabled={refreshing} aria-label={refreshing ? "Refreshing containers" : "Refresh"}><RefreshCw className={`size-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} /><span className="sr-only sm:not-sr-only">Refresh</span></Button>
      </form>
      <p className="text-xs text-muted-foreground sm:hidden" role="status">{containers.length} {containers.length === 1 ? "container" : "containers"}</p>
      <ContainerViewToggle view={view} onChange={changeView} />
    </section>
    {view === "cards" ? <section aria-label="Container cards" className="grid min-w-0 gap-4 xl:grid-cols-2">{containers.map((container) => <ContainerCard key={container.id} container={container} controlEnabled={controlEnabled} onDone={refresh} />)}</section> : <>
      <section aria-label="Container list" className="grid min-w-0 gap-3 md:hidden">{containers.map((container) => <ContainerCard key={container.id} container={container} controlEnabled={controlEnabled} compact onDone={refresh} />)}</section>
      <div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Container</th><th className="px-4 py-3 font-medium">State</th><th className="px-4 py-3 font-medium">CPU</th><th className="px-4 py-3 font-medium">RAM</th><th className="px-4 py-3 font-medium">RX / TX</th><th className="px-4 py-3 font-medium">Uptime</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead><tbody>{containers.map((container) => <ContainerRow key={container.id} container={container} controlEnabled={controlEnabled} onDone={refresh} />)}</tbody></table></div>
    </>}
    {containers.length === 0 && <p className="rounded-xl border p-6 text-center text-sm leading-6 text-muted-foreground">{query ? "No containers match this search." : "No containers have been collected yet, or Docker monitoring is disabled."}</p>}
    <p className="text-xs leading-5 text-muted-foreground">These are Docker Desktop Linux-container metrics, not metrics for the entire Windows host.</p>
  </div>;
}
