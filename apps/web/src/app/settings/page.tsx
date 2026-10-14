import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreelancehuntSettings } from "@home-dashboard/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUser } from "@/server/auth/session";
import { FreelancehuntSettingsForm } from "./freelancehunt-settings-form";

export default async function SettingsPage() {
  if (!await currentUser()) redirect("/login");
  const settings = await getFreelancehuntSettings();
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-8 lg:py-10">
    <div className="mb-8 flex items-center justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Home Dashboard</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1></div><Button variant="outline" render={<Link href="/dashboard" />}>Back to dashboard</Button></div>
    <Card><CardHeader><CardTitle>Freelancehunt</CardTitle><CardDescription>Configure monitoring and notification behaviour. Secrets remain environment variables and are never shown here.</CardDescription></CardHeader><CardContent><FreelancehuntSettingsForm settings={{ enabled: settings.enabled, projectPollingEnabled: settings.projectPollingEnabled, messagePollingEnabled: settings.messagePollingEnabled, telegramEnabled: settings.telegramEnabled, pollIntervalSeconds: settings.pollIntervalSeconds, skillIds: settings.skillIds as number[] }} /></CardContent></Card>
  </main>;
}
