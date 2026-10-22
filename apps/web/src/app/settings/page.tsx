import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreelancehuntSettings } from "@home-dashboard/database";
import { ArrowLeft, Bell } from "lucide-react";
import { currentUser } from "@/server/auth/session";
import { FreelancehuntSettingsForm } from "./freelancehunt-settings-form";
import { HeaderLink, PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  if (!await currentUser()) redirect("/login");
  const settings = await getFreelancehuntSettings();
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full min-w-0 max-w-7xl space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-7 sm:px-8 sm:py-8 lg:py-9">
    <PageHeader title="Settings"><HeaderLink href="/settings/notifications" label="Notifications and Telegram"><Bell aria-hidden="true" className="size-4" /></HeaderLink><HeaderLink href="/dashboard" label="Dashboard"><ArrowLeft aria-hidden="true" className="size-4" /></HeaderLink></PageHeader>
    <div className="hidden sm:block"><h2 className="text-xl font-semibold tracking-tight">Make it work for you.</h2><p className="mt-1.5 text-sm text-muted-foreground">Choose what to watch on Freelancehunt and how to receive updates.</p></div>
    <Link href="/settings/notifications" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"><Bell className="size-4 text-muted-foreground" />Notifications and Telegram →</Link>
    <FreelancehuntSettingsForm settings={{ enabled: settings.enabled, projectPollingEnabled: settings.projectPollingEnabled, messagePollingEnabled: settings.messagePollingEnabled, telegramEnabled: settings.telegramEnabled, pollIntervalSeconds: settings.pollIntervalSeconds, skillIds: settings.skillIds as number[] }} />
  </main></div>;
}
