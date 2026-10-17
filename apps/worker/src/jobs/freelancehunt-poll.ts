import {
  saveFreelancehuntProjects,
  saveFreelancehuntThreads,
  syncFreelancehuntCatalogue,
  type FreelancehuntSettingsInput,
} from "@home-dashboard/database";
import { observeServiceHealth } from "@home-dashboard/database";
import { FreelancehuntClient, type FreelancehuntSkill } from "@home-dashboard/integrations";

let catalogue: FreelancehuntSkill[] = [];
let catalogueRefreshAt = 0;

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
    if (Date.now() >= catalogueRefreshAt) {
      try {
        const skills = await client.listSkills();
        await syncFreelancehuntCatalogue(skills);
        catalogue = skills;
        catalogueRefreshAt = Date.now() + (skills.length ? 86400_000 : 300_000);
      } catch { catalogueRefreshAt = Date.now() + 300_000; console.warn("freelancehunt_catalogue_unavailable"); }
    }
    const projects = await client.listProjects(settings.skillIds);
    const byId = new Map(catalogue.map((skill) => [skill.id, skill]));
    for (const project of projects) project.categories = [...new Set((project.skillIds ?? []).flatMap((id) => { const skill = byId.get(id); return skill ? [skill.groupName] : []; }))];
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
