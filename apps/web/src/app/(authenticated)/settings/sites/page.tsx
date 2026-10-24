import { redirect } from "next/navigation";
import { listSites } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { SiteEditor } from "./site-editor";
export default async function SitesSettings() {
  const user = await currentUser(); if (!user) redirect("/login");
  const sites = await listSites();
  return <><p className="text-sm text-muted-foreground">Спільні посилання для користувачів дашборда. Менше число порядку показується раніше в межах групи.</p>{sites.map(site => <SiteEditor key={JSON.stringify(site)} site={site} />)}<SiteEditor /></>;
}
