import { createServer, type IncomingMessage, type Server } from "node:http";
import { DockerClient } from "@home-dashboard/docker-monitoring";
import { createDockerAction, getDockerAction, updateDockerAction } from "@home-dashboard/database";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dockerId = /^[a-f0-9]{12,128}$/i;
const write = (res: import("node:http").ServerResponse, status: number, body: object) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
async function body(request: IncomingMessage) { const chunks: Buffer[] = []; let length = 0; for await (const chunk of request) { const value = Buffer.from(chunk); length += value.length; if (length > 4096) throw new Error("invalid_input"); chunks.push(value); } const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_input"); return value as Record<string, unknown>; }

export function startDockerControlServer(): Server | undefined {
  const token = process.env.DOCKER_CONTROL_TOKEN;
  if (process.env.DOCKER_CONTROL_ENABLED !== "true" || !token || token.length < 32) return undefined;
  const active = new Set<string>(); const client = new DockerClient();
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) return write(response, 401, { error: "unauthorized" });
    if (request.method === "GET" && request.url === "/health") return write(response, 200, { ok: true });
    if (request.method !== "POST" || request.url !== "/actions") return write(response, 404, { error: "not_found" });
    try {
      const input = await body(request); const userId = input.userId; const containerId = input.containerId; const action = input.action; const requestId = input.requestId; const confirmationName = input.confirmationName;
      if (typeof userId !== "string" || !uuid.test(userId) || typeof containerId !== "string" || !dockerId.test(containerId) || (action !== "start" && action !== "stop") || typeof requestId !== "string" || !uuid.test(requestId) || (confirmationName !== undefined && (typeof confirmationName !== "string" || confirmationName.length > 255))) return write(response, 400, { error: "invalid_input" });
      if (active.size >= 4) return write(response, 429, { error: "rate_limited" });
      const current = await client.inspectContainer(containerId);
      if (current.name.startsWith("home-dashboard-") && confirmationName !== current.name) return write(response, 409, { error: "confirmation_required" });
      if (action === "start" && current.state === "running") return write(response, 200, { status: "noop" });
      if (action === "stop" && (current.state === "exited" || current.state === "created")) return write(response, 200, { status: "noop" });
      if (!(action === "start" ? ["created", "exited"] : ["running", "restarting"]).includes(current.state)) return write(response, 409, { error: "invalid_container_state" });
      const record = await createDockerAction(userId, containerId, action, requestId); if (record.status !== "accepted") return write(response, 202, { actionId: record.id, status: record.status });
      active.add(record.id); void (async () => { try { await updateDockerAction(record.id, "executing"); if (action === "start") await client.start(containerId); else await client.stop(containerId); await updateDockerAction(record.id, "succeeded"); } catch (error) { await updateDockerAction(record.id, "failed", error instanceof Error && "code" in error ? String(error.code) : "docker_unavailable"); } finally { active.delete(record.id); } })();
      return write(response, 202, { actionId: record.id, status: "accepted" });
    } catch (error) { return write(response, 400, { error: error instanceof Error && error.message === "invalid_input" ? "invalid_input" : "internal_error" }); }
  });
  server.listen(3101, "0.0.0.0"); return server;
}
