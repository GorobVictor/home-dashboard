import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listFreelancehuntProjects, getFreelancehuntWorkspace, listPersonalFreelancehuntProjects } from "@home-dashboard/database";
import type { ScoreReason } from "@home-dashboard/integrations/freelancehunt-rules";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { currentUser } from "@/server/auth/session";
import { getMarstekDashboard, type DashboardRange } from "@/server/marstek/dashboard";
import { LogoutButton } from "./logout-button";
import { DashboardLiveUpdates } from "./live-updates";
import { FreelancehuntProjects } from "./freelancehunt-projects";
import { FreelancehuntFilters } from "./freelancehunt-filters";
import { EnergyDashboard } from "./energy-dashboard";
import { NotificationBell } from "@/components/notification-bell";
import { getDockerStatus, listDockerContainers } from "@/server/docker";
import { SystemDashboard, type SystemContainer } from "../system/system-dashboard";
import { PageHeader } from "@/components/page-header";
import { parseSavedView, viewPreferences } from "@/lib/view-preferences";

const validRanges = new Set<DashboardRange>([1, 6, 24, 168, 720]);

function serializeDockerContainer(item: Awaited<ReturnType<typeof listDockerContainers>>["items"][number]): SystemContainer {
  return { id: item.id, name: item.name, image: item.image, composeProject: item.composeProject, composeService: item.composeService, state: item.state, health: item.health, startedAt: item.startedAt?.toISOString() ?? null, exitCode: item.exitCode, restartCount: item.restartCount, lastSeenAt: item.lastSeenAt?.toISOString() ?? null, metrics: item.metrics[0] ? { cpuPercent: item.metrics[0].cpuPercent, memoryWorkingSetBytes: item.metrics[0].memoryWorkingSetBytes?.toString() ?? null, memoryLimitBytes: item.metrics[0].memoryLimitBytes?.toString() ?? null, memoryPercent: item.metrics[0].memoryPercent, networkRxPerSecond: item.metrics[0].networkRxPerSecond, networkTxPerSecond: item.metrics[0].networkTxPerSecond } : null, action: item.actions[0] ? { status: item.actions[0].status } : null };
}

function parseCustomRange(fromValue?: string, toValue?: string) {
  if (!fromValue || !toValue || !/^\d{4}-\d{2}-\d{2}$/.test(fromValue) || !/^\d{4}-\d{2}-\d{2}$/.test(toValue)) return undefined;
  const from = new Date(`${fromValue}T00:00:00.000Z`), to = new Date(`${toValue}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 90 * 864e5 || to > new Date()) return undefined;
  return { from, to };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ device?: string; range?: string; from?: string; to?: string; tab?: string; page?: string }> }) {
  const user = await currentUser(); if (!user) redirect("/login");
  const preferences = await cookies();
  const projectView = parseSavedView(preferences.get(viewPreferences.projects.cookieName)?.value);
  const containerView = parseSavedView(preferences.get(viewPreferences.containers.cookieName)?.value);
  const params = await searchParams, custom = parseCustomRange(params.from, params.to), requested = Number(params.range), requestedPage = Number(params.page);
  const range: DashboardRange = validRanges.has(requested as DashboardRange) ? requested as DashboardRange : 24;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const freelancehunt = params.tab === "freelancehunt", docker = params.tab === "docker";
  const [dashboard, workspace, recent, dockerContainers, dockerStatus] = await Promise.all([getMarstekDashboard(params.device, range, custom?.from, custom?.to), freelancehunt ? getFreelancehuntWorkspace(user.id) : null, freelancehunt ? null : listFreelancehuntProjects(1, 1), docker ? listDockerContainers() : null, docker ? getDockerStatus() : null]);
  const personal = workspace ? await listPersonalFreelancehuntProjects(user.id, workspace.filters, page) : null;
  const projectTotal = personal?.total ?? recent?.total ?? 0;
  return <div className="dark dashboard-shell min-h-screen bg-background text-foreground"><main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-8 sm:py-8 lg:py-9"><DashboardLiveUpdates userId={user.id} />
    <PageHeader title={docker ? "Docker monitoring" : freelancehunt ? "Your workspace" : "Your energy, at a glance."} mobileTitle={docker ? "Docker" : freelancehunt ? "Workspace" : "Energy"}>
      <span className="mr-2 hidden text-xs text-muted-foreground md:inline">Welcome, {user.firstName}.</span><NotificationBell /><Link href="/settings" className={buttonVariants({ variant: "outline", size: "icon", className: "size-11 sm:size-9" })} aria-label="Settings"><Settings className="size-4" /></Link><LogoutButton />
    </PageHeader>
    <nav className="min-w-0 rounded-xl border bg-muted/30 p-1 sm:w-fit" aria-label="Dashboard sections"><div className="grid grid-cols-[0.85fr_1.5fr_1fr] gap-1 sm:flex"><TabLink active={!freelancehunt && !docker} href="/dashboard">Energy</TabLink><TabLink active={freelancehunt} href="/dashboard?tab=freelancehunt">Freelancehunt <Badge variant="secondary" className="px-1.5 text-[10px] sm:text-xs">{projectTotal}</Badge></TabLink><TabLink active={docker} href="/dashboard?tab=docker">Docker</TabLink></div></nav>
    {docker && dockerContainers && dockerStatus ? <section className="space-y-3 sm:space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold sm:text-2xl">Containers</h2><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Running: {dockerStatus.running} · Unhealthy: {dockerStatus.unhealthy} · Containers: {dockerStatus.total}</p></div><Link className="text-sm font-medium text-primary hover:underline" href="/events">Events</Link></div>{process.env.DOCKER_MONITORING_ENABLED !== "true" && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Docker monitoring is disabled by DOCKER_MONITORING_ENABLED.</p>}{dockerStatus.engine?.lastError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Docker Engine is unavailable or the worker cannot access its socket.</p>}<SystemDashboard initialTotal={dockerContainers.total} initialView={containerView} initial={dockerContainers.items.map(serializeDockerContainer)} settings={{ enabled: dockerStatus.settings.enabled, pollIntervalSeconds: dockerStatus.settings.pollIntervalSeconds, stoppedAlertsEnabled: dockerStatus.settings.stoppedAlertsEnabled, unhealthyAlertsEnabled: dockerStatus.settings.unhealthyAlertsEnabled }} controlEnabled={process.env.DOCKER_CONTROL_ENABLED === "true"} /></section> : freelancehunt && workspace && personal ? <section className="space-y-3 sm:space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold sm:text-2xl"><span className="sm:hidden">Projects</span><span className="hidden sm:inline">Freelancehunt projects</span></h2><p className="hidden text-sm text-muted-foreground sm:block">Found: {personal.total} · open a project for current details.</p></div><Link className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm" href="/settings"><Settings aria-hidden="true" className="size-3.5" /><span className="sm:hidden">Configure</span><span className="hidden sm:inline">Configure monitoring</span></Link></div><FreelancehuntFilters key={JSON.stringify([workspace.filters, workspace.scoring, workspace.notificationMinScore])} workspace={workspace} initialView={projectView} /><FreelancehuntProjects initialView={projectView} projects={personal.projects.map((project) => ({ ...project, reasons: project.reasons as unknown as ScoreReason[], publishedAt: project.publishedAt?.toISOString() ?? null, discoveredAt: project.discoveredAt.toISOString() }))} /><ProjectPagination page={personal.page} pageSize={personal.pageSize} total={personal.total} /></section> : <EnergyDashboard dashboard={dashboard} rangeQuery={custom ? new URLSearchParams({ from: custom.from.toISOString().slice(0, 10), to: custom.to.toISOString().slice(0, 10) }).toString() : `range=${range}`} />}
  </main></div>;
}

function ProjectPagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const start = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4));
  const visible = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return <nav className="flex items-center justify-between gap-2 pt-2 sm:justify-center" aria-label="Project pages"><Link className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm ${page === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`} href={`/dashboard?tab=freelancehunt&page=${page - 1}`} aria-disabled={page === 1}>Previous</Link><span className="text-xs tabular-nums text-muted-foreground sm:hidden">{page} / {pages}</span>{visible.map((item) => <Link key={item} href={`/dashboard?tab=freelancehunt&page=${item}`} aria-current={item === page ? "page" : undefined} className={`hidden min-h-11 min-w-11 items-center justify-center rounded-md border px-3 py-2 text-center text-sm sm:inline-flex ${item === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{item}</Link>)}<Link className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm ${page === pages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`} href={`/dashboard?tab=freelancehunt&page=${page + 1}`} aria-disabled={page === pages}>Next</Link></nav>;
}
function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) { return <Link href={href} scroll={false} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9 sm:px-3 sm:text-sm ${active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{children}</Link>; }
