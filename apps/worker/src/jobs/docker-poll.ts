import { DockerClient, type CounterSnapshot } from "@home-dashboard/docker-monitoring";
import { getDockerMonitoringSettings, markDockerUnavailable, markMissingDockerContainers, observeServiceHealth, saveDockerObservation } from "@home-dashboard/database";

const counters = new Map<string, { counters: CounterSnapshot; sampledAt: number }>();

export async function pollDockerContainers(client = new DockerClient()): Promise<number> {
  const settings = await getDockerMonitoringSettings();
  if (!settings.enabled || process.env.DOCKER_MONITORING_ENABLED !== "true") return 0;
  try {
    const containers = await client.listContainers();
    const batches = Array.from({ length: Math.ceil(containers.length / 4) }, (_, index) => containers.slice(index * 4, index * 4 + 4));
    let saved = 0;
    for (const batch of batches) await Promise.all(batch.map(async (listed) => {
      const previous = counters.get(listed.id);
      try {
        const observed = await client.observe(listed.id, previous?.counters, previous ? Date.now() - previous.sampledAt : undefined);
        if (observed.counters) counters.set(listed.id, { counters: observed.counters, sampledAt: Date.now() }); else counters.delete(listed.id);
        await saveDockerObservation(observed); saved += 1;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "DockerApiError") console.warn("docker_container_poll_failed", { containerId: listed.id, error: error instanceof Error ? error.name : "unknown_error" });
      }
    }));
    await markMissingDockerContainers(containers.map((container) => container.id));
    await observeServiceHealth("docker_engine", true);
    return saved;
  } catch (error) {
    await markDockerUnavailable();
    await observeServiceHealth("docker_engine", false).catch(() => undefined);
    console.warn("docker_poll_failed", { error: error instanceof Error ? error.name : "unknown_error" });
    return 0;
  }
}
