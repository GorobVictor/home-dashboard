import http from "node:http";
import { calculateMetrics, type CounterSnapshot, type CalculatedMetrics } from "./metrics";
export { calculateMetrics, type CounterSnapshot, type CalculatedMetrics } from "./metrics";

export type DockerContainerState = "created" | "running" | "paused" | "restarting" | "exited" | "dead" | "removing" | "unknown";
export type DockerHealth = "healthy" | "unhealthy" | "starting" | "none" | "unknown";
export interface DockerContainer {
  id: string; name: string; image: string; state: DockerContainerState; health: DockerHealth;
  createdAt: Date | null; startedAt: Date | null; finishedAt: Date | null; exitCode: number | null; restartCount: number;
  composeProject: string | null; composeService: string | null;
}
export interface DockerObservation { container: DockerContainer; counters: CounterSnapshot | null; metrics: CalculatedMetrics | null; }
export class DockerApiError extends Error { constructor(public readonly code: "unavailable" | "not_found" | "invalid_response" | "invalid_state", message: string) { super(message); } }

const asRecord = (v: unknown): Record<string, unknown> | null => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const asString = (v: unknown) => typeof v === "string" ? v : null;
const asNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
const zero = BigInt(0);
const asBig = (v: unknown): bigint => typeof v === "number" && Number.isFinite(v) && v >= 0 ? BigInt(Math.floor(v)) : zero;
const asMaybeBig = (v: unknown): bigint | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? BigInt(Math.floor(v)) : null;
const date = (v: unknown) => { const s = asString(v); const d = s ? new Date(s) : null; return d && Number.isFinite(d.getTime()) && d.getTime() > 0 ? d : null; };
function state(value: unknown): DockerContainerState { return ["created", "running", "paused", "restarting", "exited", "dead", "removing"].includes(String(value)) ? String(value) as DockerContainerState : "unknown"; }
function health(value: unknown): DockerHealth { return ["healthy", "unhealthy", "starting"].includes(String(value)) ? String(value) as DockerHealth : value === undefined || value === null ? "none" : "unknown"; }
function sumNetwork(networks: unknown) { let rx = zero, tx = zero, found = false; const r = asRecord(networks); for (const entry of Object.values(r ?? {})) { const item = asRecord(entry); if (!item) continue; rx += asBig(item.rx_bytes); tx += asBig(item.tx_bytes); found = true; } return found ? { rx, tx } : null; }
function sumBlock(entries: unknown) { let read = zero, write = zero; let found = false; if (Array.isArray(entries)) for (const entry of entries) { const item = asRecord(entry); if (!item) continue; const op = asString(item.op)?.toLowerCase(); if (op === "read") { read += asBig(item.value); found = true; } if (op === "write") { write += asBig(item.value); found = true; } } return found ? { read, write } : null; }

export class DockerClient {
  constructor(private readonly socketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock", private readonly timeoutMs = 3_000) {}
  private request<T>(method: string, path: string): Promise<T> { return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: this.socketPath, method, path, timeout: this.timeoutMs, headers: { Host: "docker" } }, (res) => { const chunks: Buffer[] = []; res.on("data", (c: Buffer) => chunks.push(c)); res.on("end", () => { const raw = Buffer.concat(chunks).toString("utf8"); if ((res.statusCode ?? 500) === 404) return reject(new DockerApiError("not_found", "Docker resource not found")); if ((res.statusCode ?? 500) >= 400) return reject(new DockerApiError("unavailable", "Docker Engine rejected request")); if (!raw) return resolve(undefined as T); try { resolve(JSON.parse(raw) as T); } catch { reject(new DockerApiError("invalid_response", "Docker Engine returned invalid JSON")); } }); });
    req.on("timeout", () => req.destroy(new Error("timeout"))); req.on("error", () => reject(new DockerApiError("unavailable", "Docker Engine is unavailable"))); req.end();
  }); }
  async listContainers(): Promise<DockerContainer[]> { const rows = await this.request<unknown[]>("GET", "/containers/json?all=true"); if (!Array.isArray(rows)) throw new DockerApiError("invalid_response", "Docker container list is invalid"); return rows.map((row) => { const r = asRecord(row); const id = asString(r?.Id); if (!id || !/^[a-f0-9]{12,}$/i.test(id)) throw new DockerApiError("invalid_response", "Docker container ID is invalid"); const names = Array.isArray(r?.Names) ? r.Names.filter((n): n is string => typeof n === "string") : []; const labels = asRecord(r?.Labels); return { id, name: (names[0] ?? id).replace(/^\//, ""), image: asString(r?.Image) ?? "unknown", state: state(r?.State), health: health(r?.Status && String(r.Status).includes("(healthy)") ? "healthy" : undefined), createdAt: null, startedAt: null, finishedAt: null, exitCode: null, restartCount: 0, composeProject: asString(labels?.["com.docker.compose.project"]), composeService: asString(labels?.["com.docker.compose.service"]) }; }); }
  async inspectContainer(id: string): Promise<DockerContainer> { const r = asRecord(await this.request<unknown>("GET", `/containers/${encodeURIComponent(id)}/json`)); const config = asRecord(r?.Config); const st = asRecord(r?.State); const labels = asRecord(config?.Labels); const resolved = asString(r?.Id); if (!resolved) throw new DockerApiError("invalid_response", "Docker container data is invalid"); return { id: resolved, name: (asString(r?.Name) ?? resolved).replace(/^\//, ""), image: asString(config?.Image) ?? "unknown", state: state(st?.Status), health: health(asRecord(st?.Health)?.Status), createdAt: date(r?.Created), startedAt: date(st?.StartedAt), finishedAt: date(st?.FinishedAt), exitCode: asNumber(st?.ExitCode), restartCount: asNumber(r?.RestartCount) ?? 0, composeProject: asString(labels?.["com.docker.compose.project"]), composeService: asString(labels?.["com.docker.compose.service"]) }; }
  async containerStats(id: string): Promise<CounterSnapshot> { const r = asRecord(await this.request<unknown>("GET", `/containers/${encodeURIComponent(id)}/stats?stream=false&one-shot=true`)); const cpu = asRecord(r?.cpu_stats); const cpuUsage = asRecord(cpu?.cpu_usage); const mem = asRecord(r?.memory_stats); const memStats = asRecord(mem?.stats); const net = sumNetwork(r?.networks); const block = sumBlock(r?.blkio_stats && asRecord(r.blkio_stats)?.io_service_bytes_recursive); return { cpuTotal: asBig(cpuUsage?.total_usage), systemCpuTotal: asBig(cpu?.system_cpu_usage), onlineCpus: asNumber(cpu?.online_cpus) ?? (Array.isArray(cpuUsage?.percpu_usage) ? cpuUsage.percpu_usage.length : 1), memoryUsage: mem && "usage" in mem ? asMaybeBig(mem.usage) : null, memoryCache: memStats ? asMaybeBig(memStats.inactive_file ?? memStats.total_inactive_file ?? memStats.cache) : null, memoryLimit: mem && "limit" in mem ? asMaybeBig(mem.limit) : null, networkRx: net?.rx ?? null, networkTx: net?.tx ?? null, blockRead: block?.read ?? null, blockWrite: block?.write ?? null, pids: asNumber(asRecord(r?.pids_stats)?.current) }; }
  async observe(id: string, previous?: CounterSnapshot, elapsedMs?: number): Promise<DockerObservation> { const container = await this.inspectContainer(id); const counters = container.state === "running" ? await this.containerStats(id) : null; return { container, counters, metrics: counters ? calculateMetrics(counters, previous, elapsedMs) : null }; }
  async start(id: string) { await this.request<void>("POST", `/containers/${encodeURIComponent(id)}/start`); }
  async stop(id: string) { await this.request<void>("POST", `/containers/${encodeURIComponent(id)}/stop?t=10`); }
}
