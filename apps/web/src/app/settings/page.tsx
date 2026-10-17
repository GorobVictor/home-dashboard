import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreelancehuntSettings } from "@home-dashboard/database";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/server/auth/session";
import { FreelancehuntSettingsForm } from "./freelancehunt-settings-form";
import { PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  if (!await currentUser()) redirect("/login");
  const settings = await getFreelancehuntSettings();
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full min-w-0 max-w-7xl space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-7 sm:px-8 sm:py-8 lg:py-9">
    <PageHeader title="Settings"><Button variant="outline" size="icon" aria-label="Notifications and Telegram" title="Notifications and Telegram" render={<Link href="/settings/notifications" />}><Bell className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Dashboard" title="Dashboard" render={<Link href="/dashboard" />}><ArrowLeft className="size-4" /></Button></PageHeader>
    <div className="hidden sm:block"><h2 className="text-xl font-semibold tracking-tight">Make it work for you.</h2><p className="mt-1.5 text-sm text-muted-foreground">Choose what to watch on Freelancehunt and how to receive updates.</p></div>
    <Link href="/settings/notifications" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Bell className="size-4 text-muted-foreground" />Notifications and Telegram →</Link>
    <FreelancehuntSettingsForm settings={{ enabled: settings.enabled, projectPollingEnabled: settings.projectPollingEnabled, messagePollingEnabled: settings.messagePollingEnabled, telegramEnabled: settings.telegramEnabled, pollIntervalSeconds: settings.pollIntervalSeconds, skillIds: settings.skillIds as number[] }} />
  </main></div>;
}
