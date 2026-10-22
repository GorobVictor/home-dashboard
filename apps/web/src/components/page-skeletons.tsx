import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, OptionListSkeleton } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 space-y-4 rounded-2xl border bg-card p-3 sm:space-y-5 sm:p-6 ${className}`}>{children}</div>;
}

function Heading() {
  return <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-3/4 max-w-64" /></div>;
}

function Fields({ count = 4 }: { count?: number }) {
  return <div className="grid min-w-0 grid-cols-2 gap-3">{Array.from({ length: count }, (_, index) => <div key={index} className="min-w-0 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-full rounded-lg" /></div>)}</div>;
}

function PageSkeleton({ title, mobileTitle, label, children, narrow = false }: { title: string; mobileTitle?: string; label: string; children: ReactNode; narrow?: boolean }) {
  return <div className="dashboard-shell min-h-screen"><main className={`mx-auto w-full min-w-0 space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:px-8 sm:py-8 ${narrow ? "max-w-6xl" : "max-w-7xl lg:py-9"}`}>
    <PageHeader title={title} mobileTitle={mobileTitle}>
      <div aria-hidden="true" className="flex gap-1 sm:gap-2"><Skeleton className="size-9 rounded-lg" /><Skeleton className="size-11 rounded-lg sm:size-9" /><Skeleton className="size-11 rounded-lg sm:h-9 sm:w-20" /></div>
    </PageHeader>
    <LoadingState label={label} className="min-w-0 space-y-3 sm:space-y-6">{children}</LoadingState>
  </main></div>;
}

export function DashboardSkeleton({ tab = "energy" }: { tab?: string }) {
  const projects = tab === "freelancehunt", sites = tab === "sites";
  return <PageSkeleton title={sites ? "Мої сайти" : projects ? "Your workspace" : "Your energy, at a glance."} mobileTitle={sites ? "Мої сайти" : projects ? "Workspace" : "Energy"} label="Loading dashboard">
    <div className="grid grid-cols-[0.8fr_1.4fr_1fr] gap-1 rounded-xl border bg-muted/30 p-1 sm:w-96">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-11 rounded-lg sm:h-9" />)}</div>
    {sites ? <SitesSkeleton /> : projects ? <ProjectsSkeleton /> : <EnergySkeleton />}
  </PageSkeleton>;
}

function EnergySkeleton() {
  return <div className="space-y-4 sm:space-y-8">
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Panel>
        <div className="flex items-start justify-between gap-3"><Heading /><Skeleton className="h-6 w-20 shrink-0 rounded-full" /></div>
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 sm:block sm:space-y-5">
          <Skeleton className="mx-auto size-28 rounded-full sm:size-48" />
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">{[0, 1].map((index) => <div key={index} className="space-y-3 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-6 w-4/5" /><Skeleton className="h-3 w-2/3" /></div>)}</div>
        </div>
        <div className="flex justify-between border-t pt-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
      </Panel>
      <Panel className="hidden lg:block"><Heading /><div className="grid grid-cols-2 gap-4 py-4">{[0, 1, 2, 3].map((index) => <div key={index} className="space-y-3 rounded-xl border p-5"><Skeleton className="size-9 rounded-xl" /><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /></div>)}</div></Panel>
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/30 p-1 lg:hidden"><Skeleton className="h-11 rounded-lg" /><Skeleton className="h-11 rounded-lg" /></div>
    </div>
    <div className="space-y-3 sm:space-y-5"><Heading />
      <div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-11 w-12 rounded-lg sm:h-9 sm:w-16" />)}<Skeleton className="h-11 w-32 rounded-lg sm:h-9" /></div>
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">{[0, 1, 2].map((index) => <Panel key={index} className={index === 2 ? "xl:col-span-2" : ""}><Heading /><div className="relative h-48 border-b border-l border-border/60 sm:h-60"><div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-border/40" />)}</div><Skeleton className="absolute inset-x-3 bottom-4 h-1/2 rounded-xl" /></div><div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /></div></Panel>)}</div>
    </div>
    <Panel><Heading /><Fields count={6} /></Panel>
  </div>;
}

function ProjectsSkeleton() {
  return <div className="space-y-4"><Heading />
    <Panel><Heading /><div className="hidden space-y-4 sm:block"><Fields count={8} /><Skeleton className="h-10 w-32 rounded-lg" /></div></Panel>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Panel key={index}><div className="flex gap-2"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /><div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div><Skeleton className="h-3 w-24" /><div className="flex gap-2 border-t pt-3"><Skeleton className="h-7 w-16" /><Skeleton className="ml-auto size-7" /></div></Panel>)}</div>
  </div>;
}

function SitesSkeleton() {
  return <div className="space-y-4"><Heading /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex gap-3 rounded-2xl border bg-card p-4 sm:gap-4 sm:p-5"><Skeleton className="size-11 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-full" /></div></div>)}</div></div>;
}

export function SettingsSkeleton() {
  return <PageSkeleton title="Settings" label="Loading settings">
    <div className="hidden sm:block"><Heading /></div><Skeleton className="h-11 w-64 rounded-lg" />
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4"><Panel><Heading />{[0, 1, 2].map((index) => <SettingSkeleton key={index} />)}<div className="space-y-3 border-t pt-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-28 rounded-xl" /><Skeleton className="h-3 w-3/4" /></div></Panel><Panel><Heading /><SettingSkeleton /></Panel></div>
      <Panel><Heading /><Skeleton className="h-10 w-full rounded-xl" /><div className="h-[min(24rem,55dvh)] overflow-hidden rounded-xl border bg-background/30 p-3 sm:h-[36rem]"><OptionListSkeleton rows={10} /></div><Skeleton className="h-3 w-3/4" /></Panel>
      <div className="flex justify-end rounded-xl border bg-card p-2 sm:p-4 lg:col-span-2"><Skeleton className="h-10 w-full rounded-xl sm:w-40" /></div>
    </div>
  </PageSkeleton>;
}

function SettingSkeleton() {
  return <div className="flex items-start gap-3 rounded-xl border p-2.5 sm:p-3.5"><Skeleton className="size-4 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="h-5 w-9 shrink-0 rounded-full" /></div>;
}

function RecordSkeleton() {
  return <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4"><div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-24" /><Skeleton className="ml-auto h-4 w-20 sm:w-36" /></div><Skeleton className="h-4 w-4/5 max-w-xl" /><Skeleton className="h-3 w-24" /></div>;
}

export function EventsSkeleton() {
  return <PageSkeleton title="Event log" label="Loading events" narrow>
    <Panel><div className="sm:hidden"><Skeleton className="h-5 w-32" /></div><div className="hidden sm:block"><Fields count={6} /></div></Panel>
    <Skeleton className="h-4 w-24" /><div className="space-y-2 sm:space-y-3">{Array.from({ length: 6 }, (_, index) => <RecordSkeleton key={index} />)}</div>
    <div className="flex justify-between"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-32" /></div>
  </PageSkeleton>;
}

export function NotificationSettingsSkeleton() {
  return <PageSkeleton title="Notifications and Telegram" mobileTitle="Notifications" label="Loading notification channels">
    <div className="rounded-xl border bg-card p-3"><Skeleton className="h-5 w-56 max-w-full" /></div>
    <Panel><Heading /><Fields /><div className="flex flex-wrap gap-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-8 w-24 rounded-lg" />)}</div><SettingSkeleton /><div className="border-t pt-3"><Skeleton className="h-9 w-24 rounded-lg" /></div></Panel>
    <Heading /><DeliveryPaginationSkeleton />
    <div className="space-y-2">{[0, 1, 2].map((index) => <RecordSkeleton key={index} />)}</div>
    <DeliveryPaginationSkeleton />
  </PageSkeleton>;
}

function DeliveryPaginationSkeleton() {
  return <div className="flex flex-wrap items-center justify-between gap-2"><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div><div className="flex gap-2"><Skeleton className="h-11 w-20 rounded-lg" /><Skeleton className="h-11 w-16 rounded-lg" /></div></div>;
}

export function LoginSkeleton() {
  return <main className="dashboard-shell flex min-h-dvh items-center justify-center px-3 py-6 sm:px-4 sm:py-16"><LoadingState label="Loading sign in" className="w-full max-w-sm space-y-5 sm:space-y-7">
    <div className="flex items-center justify-center gap-3"><Skeleton className="size-11 rounded-2xl" /><div className="space-y-2"><Skeleton className="h-3 w-36" /><Skeleton className="h-4 w-32" /></div></div>
    <Panel><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-3/4" /><div className="space-y-5">{[0, 1].map((index) => <div key={index} className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}<Skeleton className="h-11 w-full rounded-xl" /></div></Panel>
  </LoadingState></main>;
}
