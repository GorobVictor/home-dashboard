import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/server/auth/session";
import { boundedPage, listDockerContainers } from "@/server/docker";
const json = (value: bigint | null | undefined) => value?.toString() ?? null;
export async function GET(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const page = boundedPage(request.nextUrl.searchParams.get("page"));
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? undefined;
  if (!page || query.length > 100 || (state && !/^[a-z]{3,16}$/.test(state))) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const result = await listDockerContainers(page, query, state);
  return NextResponse.json({ ...result, items: result.items.map((item) => ({
    ...item,
    metrics: item.metrics.map((metric) => ({
      ...metric,
      id: metric.id.toString(),
      memoryUsageBytes: json(metric.memoryUsageBytes),
      memoryWorkingSetBytes: json(metric.memoryWorkingSetBytes),
      memoryLimitBytes: json(metric.memoryLimitBytes),
      networkRxBytes: json(metric.networkRxBytes),
      networkTxBytes: json(metric.networkTxBytes),
      blockReadBytes: json(metric.blockReadBytes),
      blockWriteBytes: json(metric.blockWriteBytes),
    })),
  })) }, { headers: { "Cache-Control": "no-store" } });
}
