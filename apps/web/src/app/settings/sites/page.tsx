import Link from "next/link";
import { redirect } from "next/navigation";
import { listSites } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { PageHeader } from "@/components/page-header";
import { SiteEditor } from "./site-editor";
export default async function SitesSettings() {
  if (!await currentUser()) redirect("/login");
  const sites = await listSites();
  return <main className="dashboard-shell min-h-screen p-3 sm:p-8"><div className="mx-auto max-w-4xl space-y-4"><PageHeader title="Мої сайти"><Link href="/dashboard?tab=sites" className="underline">До сайтів</Link></PageHeader><p className="text-sm text-muted-foreground">Спільні посилання для користувачів дашборда. Менше число порядку показується раніше в межах групи.</p>{sites.map(site => <SiteEditor key={JSON.stringify(site)} site={site} />)}<SiteEditor /></div></main>;
}
