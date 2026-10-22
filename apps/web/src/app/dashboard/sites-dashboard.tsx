import { AppWindow, Braces, Clapperboard, Container, Database, Download, ExternalLink, Layers3 } from "lucide-react";

const sites = [
  { name: "Timeflow API", host: "api.timeflow.club", description: "API сервісу Timeflow", icon: Braces },
  { name: "Timeflow", host: "app.timeflow.club", description: "Застосунок Timeflow", icon: AppWindow },
  { name: "Portainer", host: "portainer.gorob.space", description: "Керування контейнерами", icon: Container },
  { name: "Torrent", host: "torrent.gorob.space", description: "Торент-завантаження", icon: Download },
  { name: "Plex", host: "plex.gorob.space", description: "Медіатека та перегляд відео", icon: Clapperboard },
  { name: "pgAdmin", host: "pgadmin.gorob.space", description: "Керування PostgreSQL", icon: Database },
  { name: "Redis", host: "redis.gorob.space", description: "Керування Redis", icon: Layers3 },
] as const;

export function SitesDashboard() {
  return <section aria-labelledby="sites-heading" className="space-y-4 sm:space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="sites-heading" className="text-base font-semibold tracking-tight sm:text-xl">Усі сервіси під рукою</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">Оберіть сайт — він відкриється в новій вкладці.</p>
      </div>
      <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{sites.length} сайтів</span>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map(({ name, host, description, icon: Icon }) => <a key={host} href={`https://${host}/`} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-4 sm:p-5">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold sm:text-base">{name}</span>
          <span className="mt-1 block break-all text-xs text-primary">{host}</span>
          <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
          <span className="sr-only">Відкриється в новій вкладці</span>
        </span>
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </a>)}
    </div>
  </section>;
}
