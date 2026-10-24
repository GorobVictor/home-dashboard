import { redirect } from "next/navigation";
import { getFreelancehuntSettings } from "@home-dashboard/database";
import { SettingsIntro } from "@/components/settings-intro";
import { currentUser } from "@/server/auth/session";
import { FreelancehuntSettingsForm } from "./freelancehunt-settings-form";

export default async function SettingsPage() {
  const user = await currentUser(); if (!user) redirect("/login");
  const settings = await getFreelancehuntSettings();
  return <>
    <SettingsIntro />
    <FreelancehuntSettingsForm settings={{ enabled: settings.enabled, projectPollingEnabled: settings.projectPollingEnabled, messagePollingEnabled: settings.messagePollingEnabled, telegramEnabled: settings.telegramEnabled, pollIntervalSeconds: settings.pollIntervalSeconds, skillIds: settings.skillIds as number[] }} />
  </>;
}
