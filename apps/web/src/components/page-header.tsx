import type { ReactNode } from "react";
import { BatteryFull } from "lucide-react";

export function PageHeader({ title, mobileTitle = title, children }: { title: string; mobileTitle?: string; children: ReactNode }) {
  return <header className="sticky top-0 z-30 -mx-3 flex min-h-16 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-md sm:static sm:mx-0 sm:min-h-0 sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
    <div className="flex min-w-0 items-center gap-3">
      <div className="hidden size-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 sm:grid"><BatteryFull aria-hidden="true" className="size-5 text-emerald-300" /></div>
      <div className="min-w-0"><p className="text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground sm:text-xs">Home Dashboard</p><h1 title={title} className="mt-0.5 truncate text-lg leading-tight font-semibold tracking-tight sm:mt-1 sm:text-3xl"><span className="sm:hidden">{mobileTitle}</span><span className="hidden sm:inline">{title}</span></h1></div>
    </div>
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">{children}</div>
  </header>;
}
