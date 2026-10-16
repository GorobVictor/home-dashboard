import {
  saveFreelancehuntProjects,
  saveFreelancehuntThreads,
  type FreelancehuntSettingsInput,
} from "@home-dashboard/database";
import { observeServiceHealth } from "@home-dashboard/database";
import { FreelancehuntClient } from "@home-dashboard/integrations";

interface FreelancehuntPollSettings extends FreelancehuntSettingsInput {
  projectsInitialized: boolean;
  messagesInitialized: boolean;
}

export async function pollFreelancehunt(settings: FreelancehuntPollSettings): Promise<void> {
  const token = process.env.FREELANCEHUNT_API_TOKEN?.trim();
  if (!settings.enabled || !token) return;
  const client = new FreelancehuntClient(token);
  try {
  if (settings.projectPollingEnabled) {
    const projects = await client.listProjects(settings.skillIds);
    const result = await saveFreelancehuntProjects(projects);
    console.info("freelancehunt_projects_polled", { received: projects.length, discovered: result.projects.length });
  }

  if (settings.messagePollingEnabled) {
    const threads = await client.listThreads();
    const result = await saveFreelancehuntThreads(threads);
    console.info("freelancehunt_threads_polled", { received: threads.length, discovered: result.threads.length });
  }
  if (settings.projectPollingEnabled || settings.messagePollingEnabled) await observeServiceHealth("freelancehunt", true);
  } catch {
    await observeServiceHealth("freelancehunt", false);
    throw new Error("freelancehunt_poll_failed");
  }
}
