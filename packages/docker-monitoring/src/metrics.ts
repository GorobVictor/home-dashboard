export interface CounterSnapshot {
  cpuTotal: bigint;
  systemCpuTotal: bigint;
  onlineCpus: number;
  memoryUsage: bigint | null;
  memoryCache: bigint | null;
  memoryLimit: bigint | null;
  networkRx: bigint | null;
  networkTx: bigint | null;
  blockRead: bigint | null;
  blockWrite: bigint | null;
  pids: number | null;
}

export interface CalculatedMetrics {
  cpuPercent: number | null;
  memoryUsageBytes: bigint | null;
  memoryWorkingSetBytes: bigint | null;
  memoryLimitBytes: bigint | null;
  memoryPercent: number | null;
  networkRxBytes: bigint | null;
  networkTxBytes: bigint | null;
  networkRxPerSecond: number | null;
  networkTxPerSecond: number | null;
  blockReadBytes: bigint | null;
  blockWriteBytes: bigint | null;
  pids: number | null;
}

const zero = BigInt(0);
const nonNegative = (value: bigint | null) => value !== null && value >= zero ? value : null;
const rate = (current: bigint | null, previous: bigint | null | undefined, elapsedMs: number) => {
  if (current === null || previous === null || previous === undefined || current < previous || elapsedMs <= 0 || elapsedMs > 5 * 60_000) return null;
  return Number(current - previous) / (elapsedMs / 1_000);
};

export function calculateMetrics(current: CounterSnapshot, previous?: CounterSnapshot, elapsedMs?: number): CalculatedMetrics {
  const usage = nonNegative(current.memoryUsage);
  const cache = nonNegative(current.memoryCache);
  const working = usage === null ? null : cache === null ? usage : usage > cache ? usage - cache : zero;
  const limit = nonNegative(current.memoryLimit);
  const cpuDelta = previous ? current.cpuTotal - previous.cpuTotal : zero;
  const systemDelta = previous ? current.systemCpuTotal - previous.systemCpuTotal : zero;
  const cpuPercent = previous && cpuDelta >= zero && systemDelta > zero && current.onlineCpus > 0
    ? Number(cpuDelta) / Number(systemDelta) * current.onlineCpus * 100 : null;
  return {
    cpuPercent: Number.isFinite(cpuPercent ?? NaN) ? cpuPercent : null,
    memoryUsageBytes: usage,
    memoryWorkingSetBytes: working,
    memoryLimitBytes: limit,
    memoryPercent: working !== null && limit !== null && limit > zero ? Number(working) / Number(limit) * 100 : null,
    networkRxBytes: nonNegative(current.networkRx), networkTxBytes: nonNegative(current.networkTx),
    networkRxPerSecond: rate(current.networkRx, previous?.networkRx, elapsedMs ?? 0),
    networkTxPerSecond: rate(current.networkTx, previous?.networkTx, elapsedMs ?? 0),
    blockReadBytes: nonNegative(current.blockRead), blockWriteBytes: nonNegative(current.blockWrite), pids: current.pids,
  };
}
