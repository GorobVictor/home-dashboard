import Link from "next/link";
import { Bell, Globe, List } from "lucide-react";

export function SettingsIntro() {
  return <>
    <div className="space-y-1"><h2 className="text-xl font-semibold tracking-tight">Моніторинг і сервіси</h2><p className="mt-1.5 text-sm text-muted-foreground">Оберіть, що відстежувати на Freelancehunt і як отримувати сповіщення.</p></div>
    <nav aria-label="Розділи налаштувань" className="grid gap-3 sm:grid-cols-3">
      {[{ href: "/settings/notifications", label: "Сповіщення та Telegram", icon: Bell }, { href: "/settings/sites", label: "Редагувати мої сайти", icon: Globe }, { href: "/events", label: "Журнал подій", icon: List }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted"><Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />{label}</Link>)}
    </nav>
  </>;
}
