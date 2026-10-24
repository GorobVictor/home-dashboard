"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export function DashboardTabs({ total }: { total: number }) {
  const requested = useSearchParams().get("tab");
  const active = requested === "sites" || requested === "freelancehunt" ? requested : "energy";
  return <nav className="min-w-0 rounded-xl border bg-muted/30 p-1 sm:w-fit" aria-label="Розділи дашборда"><div className="grid grid-cols-[0.8fr_1.4fr_1fr] gap-1 sm:flex">
    {([{ id: "energy", href: "/dashboard", label: "Енергія" }, { id: "freelancehunt", href: "/dashboard?tab=freelancehunt", label: "Freelancehunt" }, { id: "sites", href: "/dashboard?tab=sites", label: "Мої сайти" }] as const).map(tab => <Link key={tab.id} href={tab.href} scroll={false} aria-current={active === tab.id ? "page" : undefined} className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3 sm:text-sm ${active === tab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}{tab.id === "freelancehunt" && <Badge title={`${total} проєктів`} variant="secondary" className="w-8 shrink-0 justify-center px-1 text-[10px] tabular-nums sm:text-xs">{total > 999 ? "999+" : total}</Badge>}</Link>)}
  </div></nav>;
}
