import type { ReactNode } from "react";
import { BatteryFull, BatteryCharging, Clock3, PlugZap, ShieldCheck, Sun, Thermometer, UtilityPole, Zap } from "lucide-react";
import { Card, CardHeader, CardContent, CardDescription } from "@/components/ui/card";
import { HelpText } from "@/components/help-text";
import { EnergyOverview } from "@/app/(authenticated)/dashboard/energy-overview";
import { energyBatteryCardClassName, energyBatteryContentClassName, energyFlowCardClassName, energyFlowMapClassName, energyFlowFooterClassName } from "@/lib/ui-layout";
import { SettingsIntro } from "@/components/settings-intro";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, OptionListSkeleton } from "@/components/loading-state";
import type { SavedView } from "@/lib/view-preferences";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface-panel space-y-4 sm:space-y-5 ${className}`}>{children}</div>;
}

function Heading({ title, description }: { title?: string; description?: string }) {
  return <div className="space-y-2">{title ? <h2 className="text-base font-semibold">{title}</h2> : <Skeleton className="h-5 w-36" />}{description ? <p className="text-sm text-muted-foreground">{description}</p> : <Skeleton className="h-3 w-3/4 max-w-64" />}</div>;
}

function Fields({ count = 4 }: { count?: number }) {
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">{Array.from({ length: count }, (_, index) => <div key={index} className="min-w-0 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full rounded-lg sm:h-11" /></div>)}</div>;
}

function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return <LoadingState label={label} className="page-loading">{children}</LoadingState>;
}

export function DashboardSkeleton({ tab = "energy", projectView = "cards" }: { tab?: string; projectView?: SavedView }) {
  const projects = tab === "freelancehunt", sites = tab === "sites";
  return <PageSkeleton label="Завантажуємо дашборд">
    {sites ? <SitesSkeleton /> : projects ? <ProjectsSkeleton view={projectView} /> : <EnergySkeleton />}
  </PageSkeleton>;
}

function EnergySkeleton() {
  return <div className="space-y-4 sm:space-y-8">
    <EnergyOverview battery={<Card className={energyBatteryCardClassName}>
      <CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="energy-eyebrow">Ваша батарея</p><div className="mt-1 flex h-7 items-center sm:mt-1.5 sm:h-8"><Skeleton className="h-5 w-36 max-w-full" /></div></div><Skeleton className="h-6 w-20 shrink-0 rounded-full" /></div></CardHeader>
      <CardContent className={energyBatteryContentClassName}>
        <div className="flex items-center justify-center py-1"><div className="relative grid size-28 place-items-center rounded-full border-[6px] border-muted sm:size-48 sm:border-8"><div className="flex size-full flex-col items-center justify-center rounded-full bg-card"><BatteryFull aria-hidden="true" className="mb-1 size-4 text-emerald-300 sm:mb-2 sm:size-5" /><Skeleton className="h-9 w-16 sm:h-12 sm:w-24" /><p className="mt-1 text-[9px] text-muted-foreground sm:mt-2 sm:text-xs">Рівень заряду</p></div></div></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-3">
          <div className="min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5 shrink-0" /><HelpText>Час до розряду</HelpText></p><div className="mt-1 flex h-6 items-center sm:mt-2 sm:h-7"><Skeleton className="h-5 w-4/5" /></div><p className="mt-1 hidden text-[11px] leading-4 text-muted-foreground sm:block">За поточного навантаження</p></div>
          <div className="min-w-0 rounded-xl bg-foreground/[0.04] px-3 py-2 sm:p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BatteryCharging aria-hidden="true" className="size-3.5 shrink-0" /><HelpText>Запас енергії</HelpText></p><div className="mt-1 flex h-6 items-center sm:mt-2 sm:h-7"><Skeleton className="h-5 w-4/5" /></div><div className="mt-1 flex h-4 items-center"><Skeleton className="h-2.5 w-full" /></div></div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground sm:pt-4"><span className="inline-flex items-center gap-1.5"><Thermometer aria-hidden="true" className="size-3.5" /><Skeleton className="h-3 w-12" /></span><Skeleton className="h-3 w-32" /></div>
      </CardContent>
    </Card>} flow={<Card className={energyFlowCardClassName}>
      <CardHeader><div className="flex items-start justify-between gap-3"><div><h2 aria-label="Потоки енергії" className="text-lg font-semibold"><HelpText>Потоки енергії</HelpText></h2><CardDescription className="mt-1">Поточна потужність</CardDescription></div><Skeleton className="mt-1 h-4 w-16 shrink-0" /></div></CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between">
        <div className={energyFlowMapClassName}>
          <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 600 304" preserveAspectRatio="none" aria-hidden="true"><path d="M300 50 V254 M100 152 H500" fill="none" stroke="var(--border)" strokeWidth="1.5" /></svg>
          {[{ label: "Сонце", icon: Sun, position: "col-start-2 row-start-1" }, { label: "Мережа", icon: UtilityPole, position: "col-start-1 row-start-2" }, { label: "Резервний вихід", icon: PlugZap, position: "col-start-3 row-start-2" }, { label: "Батарея", icon: BatteryFull, position: "col-start-2 row-start-3" }].map(({ label, icon: Icon, position }) => <div key={label} className={`relative z-10 flex w-full min-w-0 flex-col items-center bg-card py-2 ${position}`}><div aria-hidden="true" className="mb-1 flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground sm:mb-1.5 sm:size-9"><Icon className="size-4 sm:size-5" /></div><div className="flex h-5 items-center sm:h-6"><Skeleton className="h-4 w-12" /></div><p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p></div>)}
          <div className="relative col-start-2 row-start-2 grid size-14 place-items-center rounded-2xl border border-emerald-300/20 bg-card"><Zap aria-hidden="true" className="size-6 text-emerald-300" /></div>
        </div>
        <div className={energyFlowFooterClassName}><span>Миттєва потужність · W</span><span className="flex h-4 items-center"><Skeleton className="h-3 w-44" /></span></div>
      </CardContent>
    </Card>} />
    <section className="surface-panel grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem] md:items-center">
      <div className="min-w-0"><div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-primary" /><h2 className="text-sm font-semibold">До резерву заряду</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Оцінка</span></div><div className="mt-3 flex h-8 items-center sm:h-9"><Skeleton className="h-7 w-40" /></div><p className="mt-2 text-xs leading-6 text-muted-foreground">За середнім навантаженням за 5 хвилин. Розрахунок припускає незмінне навантаження та не керує батареєю.</p></div>
      <div className="form-field"><span><HelpText>Резерв заряду, %</HelpText></span><Skeleton className="h-11 w-full rounded-xl" /></div>
    </section>
    <div className="space-y-3 sm:space-y-5"><Heading />
      <div className="space-y-2 sm:space-y-3"><div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/30 p-1 sm:w-fit">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-11 rounded-lg sm:w-14" />)}</div><Skeleton className="h-11 w-full sm:hidden" /><div className="hidden items-end gap-3 rounded-xl border bg-card p-4 sm:flex">{[0, 1].map((index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-10" /><Skeleton className="h-11 w-40 rounded-lg" /></div>)}<Skeleton className="h-11 w-28 rounded-lg" /></div></div>
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((index) => <Panel key={index} className={index >= 2 ? "xl:col-span-2" : ""}><Heading /><div className="relative h-48 border-b border-l border-border/60 sm:h-60"><div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-border/40" />)}</div><Skeleton className="absolute inset-x-3 bottom-4 h-1/2 rounded-xl" /></div><div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-12" /></div></Panel>)}</div>
    </div>
    <Panel><Heading /><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-24 w-full rounded-xl" />)}</div></Panel>
    <Panel><Heading /></Panel>
  </div>;
}

function ProjectsSkeleton({ view }: { view: SavedView }) {
  return <div className="space-y-4"><Heading />
    <div className="flex min-h-13 items-center justify-between gap-3 rounded-xl border bg-card p-1 pl-3 sm:pl-4"><Skeleton className="h-4 w-20" /><div className="flex gap-1">{[0, 1].map((index) => <Skeleton key={index} className="size-11 rounded-lg sm:size-8" />)}</div></div>
    {view === "list" ? <div className="divide-y overflow-hidden rounded-xl border bg-card/50">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-3 p-3"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/3" /><div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-24 rounded-full" /></div></div>)}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Panel key={index}><div className="flex gap-2"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /><div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div><Skeleton className="h-3 w-24" /><div className="flex gap-2 border-t pt-3"><Skeleton className="h-11 w-16 sm:h-7" /><Skeleton className="ml-auto size-11 sm:size-8" /></div></Panel>)}</div>}
  </div>;
}

function SitesSkeleton() {
  return <div className="space-y-4"><Heading /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex gap-3 rounded-2xl border bg-card p-4 sm:gap-4 sm:p-5"><Skeleton className="size-11 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-full" /></div></div>)}</div></div>;
}

export function SettingsSkeleton() {
  return <PageSkeleton label="Завантажуємо налаштування">
    <SettingsIntro />
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4"><Panel><Heading />{[0, 1, 2].map((index) => <SettingSkeleton key={index} />)}<div className="space-y-3 border-t pt-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-11 w-28 rounded-xl" /><Skeleton className="h-3 w-3/4" /></div></Panel><Panel><Heading /><SettingSkeleton /></Panel></div>
      <Panel><Heading /><Skeleton className="h-11 w-full rounded-xl sm:h-11" /><div className="h-[min(24rem,55dvh)] overflow-hidden rounded-xl border bg-background/30 p-3 sm:h-[36rem]"><OptionListSkeleton rows={10} compact /></div><Skeleton className="h-3 w-3/4" /></Panel>
      <div className="flex justify-end rounded-xl border bg-card p-2 sm:p-4 lg:col-span-2"><Skeleton className="h-11 w-full rounded-xl sm:h-11 sm:w-40" /></div>
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
  return <PageSkeleton label="Завантажуємо журнал">
    <Panel><div className="sm:hidden"><Skeleton className="h-5 w-32" /></div><div className="hidden sm:block"><Fields count={6} /></div></Panel>
    <Skeleton className="h-4 w-24" /><div className="space-y-2 sm:space-y-3">{Array.from({ length: 6 }, (_, index) => <RecordSkeleton key={index} />)}</div>
    <div className="flex justify-between"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-32" /></div>
  </PageSkeleton>;
}

export function NotificationSettingsSkeleton() {
  return <PageSkeleton label="Завантажуємо канали">
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

export function StatusSkeleton() {
  return <PageSkeleton label="Завантажуємо стан системи">
    <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(index => <Panel key={index}><div className="flex justify-between"><Skeleton className="size-11 rounded-xl" /><Skeleton className="h-6 w-24 rounded-full" /></div><Heading /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-3/4" /></Panel>)}</div>
    <Heading /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(index => <Panel key={index}><Skeleton className="h-6 w-24 rounded-full" /><Heading /><div className="space-y-3 border-t pt-4"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-4/5" /></div></Panel>)}</div>
    <Heading /><div className="grid gap-4 md:grid-cols-2"><Panel><Heading /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-11 w-44" /></Panel></div>
  </PageSkeleton>;
}

export function InboxSkeleton() {
  return <PageSkeleton label="Завантажуємо сповіщення"><Panel><div className="flex flex-wrap gap-3"><Skeleton className="h-11 w-36" /><Skeleton className="h-11 w-32" /></div></Panel>{[0, 1, 2, 3].map(index => <RecordSkeleton key={index} />)}</PageSkeleton>;
}

export function SitesSettingsSkeleton() {
  return <PageSkeleton label="Завантажуємо посилання">{[0, 1].map(index => <Panel key={index}><Heading /><Fields count={4} /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-32" /></Panel>)}</PageSkeleton>;
}

export function LoginSkeleton() {
  return <main className="dashboard-shell flex min-h-dvh items-center justify-center px-3 py-6 sm:px-4 sm:py-16"><LoadingState label="Завантажуємо форму входу" className="w-full max-w-sm space-y-5 sm:space-y-7">
    <div className="flex items-center justify-center gap-3"><Skeleton className="size-11 rounded-2xl" /><div className="space-y-2"><Skeleton className="h-3 w-36" /><Skeleton className="h-4 w-32" /></div></div>
    <Panel><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-3/4" /><div className="space-y-5">{[0, 1].map((index) => <div key={index} className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}<Skeleton className="h-11 w-full rounded-xl" /></div></Panel>
  </LoadingState></main>;
}
