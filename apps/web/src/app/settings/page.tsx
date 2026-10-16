import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreelancehuntSettings } from "@home-dashboard/database";
import { ArrowLeft, BatteryFull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/server/auth/session";
import { FreelancehuntSettingsForm } from "./freelancehunt-settings-form";

export default async function SettingsPage() {
  if (!await currentUser()) redirect("/login");
  const settings = await getFreelancehuntSettings();
  return <div className="dashboard-shell min-h-screen"><main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-5 sm:px-8 sm:py-8 lg:py-9">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10"><BatteryFull aria-hidden="true" className="size-5 text-emerald-300" /></div>
        <div><p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">Home Dashboard</p><h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1></div>
      </div>
      <Button variant="outline" className="h-9 gap-2 rounded-lg px-3" render={<Link href="/dashboard" />}><ArrowLeft aria-hidden="true" className="size-4" />Dashboard</Button>
    </header>
    <div><h2 className="text-xl font-semibold tracking-tight">Make it work for you.</h2><p className="mt-1.5 text-sm text-muted-foreground">Choose what to watch on Freelancehunt and how to receive updates.</p></div>
    <FreelancehuntSettingsForm settings={{ enabled: settings.enabled, projectPollingEnabled: settings.projectPollingEnabled, messagePollingEnabled: settings.messagePollingEnabled, telegramEnabled: settings.telegramEnabled, pollIntervalSeconds: settings.pollIntervalSeconds, skillIds: settings.skillIds as number[] }} />
  </main></div>;
}
