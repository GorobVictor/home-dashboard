import Link from "next/link";
import { AppWindow, ExternalLink } from "lucide-react";
import { listSites } from "@home-dashboard/database";

export async function SitesDashboard() {
  const sites = await listSites();
  const groups = [...new Set(sites.map(site => site.group))];
  return <section aria-labelledby="sites-heading" className="space-y-4 sm:space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="sites-heading" className="text-base font-semibold sm:text-xl">Усі сервіси під рукою</h2><p className="mt-1 text-sm text-muted-foreground">{sites.length} сайтів · відкриваються в новій вкладці</p></div><Link className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm" href="/settings/sites">Редагувати посилання</Link></div>
    {!sites.length && <p className="rounded-xl border p-6">Додайте перше посилання.</p>}
    {groups.map(group => <section key={group} className="space-y-3"><h3 className="font-medium">{group}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sites.filter(site => site.group === group).map(site => <a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"><AppWindow aria-hidden="true" className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block font-semibold">{site.name}</span><span className="mt-1 block break-all text-xs text-primary">{new URL(site.url).host}</span><span className="mt-2 block text-sm text-muted-foreground">{site.description}</span><span className="sr-only">Відкриється в новій вкладці</span></span><ExternalLink aria-hidden="true" className="size-4 shrink-0" /></a>)}</div></section>)}
  </section>;
}
