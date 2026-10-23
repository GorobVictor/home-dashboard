import { NextRequest, NextResponse } from "next/server";
import { listMarstekMeasurementBuckets } from "@home-dashboard/database";
import { currentUser } from "@/server/auth/session";
import { customDateRange } from "@/lib/dates";
import { csv } from "@/server/csv";

export async function GET(request: NextRequest) {
  if (!await currentUser()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const query = request.nextUrl.searchParams, id = query.get("device"), range = Number(query.get("range") ?? 24);
  if (!id || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) || ![1,6,24,168,720].includes(range)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  let custom;
  try { custom = customDateRange(query.get("from") ?? undefined, query.get("to") ?? undefined); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  try {
    const until = custom?.to ?? new Date(), since = custom?.from ?? new Date(until.getTime() - range * 3600000);
    const rows = await listMarstekMeasurementBuckets(id, since, 60, until);
    const body = csv([["timestamp_utc", "soc_percent", "charge_w", "discharge_w", "temperature_c", "grid_w", "pv_w", "charge_wh", "discharge_wh", "coverage_seconds"], ...rows.map(row => [row.sampledAt.toISOString(), row.socPercent, row.chargePowerW, row.dischargePowerW, row.batteryTemperatureC, row.gridPowerW, row.pvPowerW, row.chargeEnergyWh, row.dischargeEnergyWh, row.coverageSeconds])]);
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="telemetry.csv"', "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "internal_error" }, { status: 500 }); }
}
