"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, BatteryFull, House, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { headerIconButtonClassName } from "@/lib/ui-layout";
import { ActionTooltip } from "@/components/help-text";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardLiveUpdates } from "@/app/(authenticated)/dashboard/live-updates";
import { LogoutButton } from "@/app/(authenticated)/dashboard/logout-button";

function HeaderLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: ReactNode }) {
  return <ActionTooltip help={`Відкрити розділ «${label}».`}><Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={buttonVariants({ variant: "outline", size: "icon", className: `${headerIconButtonClassName} ${active ? "border-primary/30 bg-primary/10 text-primary" : ""}` })}>{children}</Link></ActionTooltip>;
}

export function PageHeader({ userId, firstName }: { userId: string; firstName: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab");
  const title = pathname === "/dashboard" ? tab === "sites" ? "Мої сайти" : tab === "freelancehunt" ? "Проєкти Freelancehunt" : "Енергія"
    : pathname === "/settings/notifications" ? "Сповіщення та Telegram"
    : pathname === "/settings/sites" ? "Редагування сайтів"
    : pathname === "/settings" ? "Налаштування"
    : pathname === "/notifications" ? "Мої сповіщення"
    : pathname === "/events" ? "Журнал подій" : "Стан системи";
  return <header className="app-header">
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <Link href="/dashboard" aria-label="Home Dashboard" className="hidden size-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-300 focus-visible:outline-2 focus-visible:outline-ring sm:grid"><BatteryFull aria-hidden="true" className="size-5" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex h-4 items-center gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Home Dashboard</p><DashboardLiveUpdates userId={userId} /></div>
        <h1 title={title} className="mt-1 truncate text-xl leading-7 font-semibold tracking-tight sm:text-2xl lg:text-3xl lg:leading-9">{title}</h1>
        <p data-testid="user-greeting" title={`Вітаю, ${firstName}`} className="mt-1 truncate text-xs leading-5 text-muted-foreground sm:text-sm">Вітаю, {firstName}.</p>
      </div>
    </div>
    <nav aria-label="Дії сторінки" className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
      <HeaderLink href="/dashboard" label="Дашборд" active={pathname === "/dashboard"}><House aria-hidden="true" className="size-4" /></HeaderLink>
      <HeaderLink href="/status" label="Стан системи" active={pathname === "/status"}><Activity aria-hidden="true" className="size-4" /></HeaderLink>
      <NotificationBell />
      <HeaderLink href="/settings" label="Налаштування" active={pathname.startsWith("/settings")}><Settings aria-hidden="true" className="size-4" /></HeaderLink>
      <LogoutButton />
    </nav>
  </header>;
}
