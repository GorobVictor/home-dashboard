import {
  saveFreelancehuntProjects, saveFreelancehuntThreads, syncFreelancehuntCatalogue,
  freelancehuntScan, knownFreelancehuntProjects, observeServiceHealth, recordHealth,
  type FreelancehuntSettingsInput,
} from "@home-dashboard/database";
import { FreelancehuntClient, FreelancehuntError, type FreelancehuntSkill } from "@home-dashboard/integrations";

let catalogue: FreelancehuntSkill[] = [], catalogueRefreshAt = 0;
interface PollSettings extends FreelancehuntSettingsInput { projectsInitialized: boolean; messagesInitialized: boolean }
export async function pollFreelancehunt(settings: PollSettings): Promise<number> {
  const token = process.env.FREELANCEHUNT_API_TOKEN?.trim();
  if (!settings.enabled || !token) { await recordHealth("freelancehunt", false, settings.enabled ? "not_configured" : "disabled"); return 0; }
  const client = new FreelancehuntClient(token, 10000, process.env.FREELANCEHUNT_API_BASE_URL);
  let delay = 0, failed = false, rateLimited = false;
  const run = async (kind: "projects" | "threads", operation: () => Promise<void>) => {
    try { await operation(); await recordHealth(`freelancehunt.${kind}`, true); }
    catch (error) {
      failed = true;
      if (error instanceof FreelancehuntError && error.code === "freelancehunt_rate_limited") rateLimited = true;
      const code = error instanceof FreelancehuntError ? error.code : error instanceof Error && /^freelancehunt_[a-z0-9_]+$/.test(error.message) ? error.message : "persistence_or_poll_failure";
      delay = Math.max(delay, error instanceof FreelancehuntError && error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : 60000);
      await recordHealth(`freelancehunt.${kind}`, false, code);
      console.error("freelancehunt_poll_failed", { kind, code });
    }
  };
  if (settings.projectPollingEnabled) await run("projects", async () => {
    if (Date.now() >= catalogueRefreshAt) {
      try {
        const skills = await client.listSkills();
        await syncFreelancehuntCatalogue(skills); catalogue = skills;
        catalogueRefreshAt = Date.now() + (skills.length ? 86400000 : 300000);
      } catch (error) {
        catalogueRefreshAt = Date.now() + 300000;
        if (error instanceof FreelancehuntError && error.retryAfterSeconds) throw error;
        console.warn("freelancehunt_catalogue_unavailable");
      }
    }
    const scan = await freelancehuntScan("projects", settings.projectsInitialized);
    let page = scan.page;
    const byId = new Map(catalogue.map(skill => [skill.id, skill]));
    for (let calls = 0; calls < 5; calls++) {
      // Always inspect the newest page while resuming a bounded catch-up.
      const current = calls === 0 ? 1 : page;
      const response = await client.projectPage(settings.skillIds, current);
      const known = response.items.length ? await knownFreelancehuntProjects(response.items.map(project => project.id)) : 0;
      for (const project of response.items) project.categories = [...new Set((project.skillIds ?? []).flatMap(id => { const skill = byId.get(id); return skill ? [skill.groupName] : []; }))];
      const caughtUp = !response.more || (!scan.baseline && response.items.length > 0 && known === response.items.length && (current > 1 || scan.page === 1));
      page = current === 1 && scan.page > 1 ? scan.page : current + 1;
      if (page > 10000) throw new Error("freelancehunt_pagination_limit");
      await saveFreelancehuntProjects(response.items, scan.baseline, { page: caughtUp ? 1 : page, baseline: caughtUp ? false : scan.baseline });
      if (caughtUp) break;
    }
  });
  // A provider-wide 429 pauses both streams. Other project failures do not block threads.
  if (settings.messagePollingEnabled && !rateLimited) await run("threads", async () => {
    const scan = await freelancehuntScan("threads", settings.messagesInitialized);
    let page = scan.page;
    for (let calls = 0; calls < 3; calls++) {
      const current = calls === 0 ? 1 : page;
      const response = await client.threadPage(current);
      page = current === 1 && scan.page > 1 ? scan.page : current + 1;
      if (page > 10000) throw new Error("freelancehunt_pagination_limit");
      await saveFreelancehuntThreads(response.items, scan.baseline, { page: response.more ? page : 1, baseline: response.more && scan.baseline });
      if (!response.more) break;
    }
  });
  if (settings.projectPollingEnabled || settings.messagePollingEnabled) {
    await observeServiceHealth("freelancehunt", !failed);
    await recordHealth("freelancehunt", !failed, failed ? "partial_failure" : "");
  }
  return delay;
}
