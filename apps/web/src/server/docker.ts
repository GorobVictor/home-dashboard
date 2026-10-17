import { getDockerAction, getDockerMonitoringSettings, getDockerStatus, listDockerActions, listDockerContainers, listDockerHistory, updateDockerMonitoringSettings } from "@home-dashboard/database";

export const dockerId = (value: string) => /^[a-f0-9]{12,128}$/i.test(value);
export const actionId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const boundedPage = (value: string | null) => { const page = Number(value ?? "1"); return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : null; };
export { getDockerAction, getDockerMonitoringSettings, getDockerStatus, listDockerActions, listDockerContainers, listDockerHistory, updateDockerMonitoringSettings };

export async function requestDockerAction(input: { userId: string; containerId: string; action: "start" | "stop"; requestId: string; confirmationName?: string }) {
  if (process.env.DOCKER_CONTROL_ENABLED !== "true") return { error: "control_disabled" as const };
  const token = process.env.DOCKER_CONTROL_TOKEN; const url = process.env.DOCKER_CONTROL_URL ?? "http://worker:3101";
  if (!token || token.length < 32) return { error: "control_disabled" as const };
  try {
    const response = await fetch(`${url}/actions`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(5_000), cache: "no-store" });
    const data: unknown = await response.json(); if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "docker_unavailable" as const };
    return data as { actionId?: string; status?: string; error?: string };
  } catch { return { error: "docker_unavailable" as const }; }
}
