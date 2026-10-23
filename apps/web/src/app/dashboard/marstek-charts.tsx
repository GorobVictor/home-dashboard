"use client";

import type { ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { getMarstekDashboard } from "@/server/marstek/dashboard";

type Dashboard = Awaited<ReturnType<typeof getMarstekDashboard>>;

const socConfig = { soc: { label: "Charge", color: "var(--chart-1)" } } satisfies ChartConfig;
const powerConfig = {
  charge: { label: "Charging", color: "var(--chart-2)" },
  discharge: { label: "Discharging", color: "var(--chart-4)" },
  pv: { label: "Solar", color: "var(--chart-3)" },
} satisfies ChartConfig;
const energyConfig = {
  chargeWh: { label: "Charged", color: "var(--chart-2)" },
  dischargeWh: { label: "Discharged", color: "var(--chart-4)" },
} satisfies ChartConfig;

function timeLabel(value: string | number, hours: number) {
  const date = new Date(value);
  return hours <= 24
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tooltipTimeLabel = (value: unknown) => new Date(Number(value)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function unitValue(value: unknown, unit: string) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number).toLocaleString("uk-UA")} ${unit}` : "—";
}

const axisValue = (value: number) => value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

const powerLabels: Record<string, string> = { charge: "Charging", discharge: "Discharging", pv: "Solar" };
const energyLabels: Record<string, string> = { chargeWh: "Charged", dischargeWh: "Discharged" };

export function MarstekCharts({ points, energy, hours, period, rangeStart, rangeEnd }: Pick<Dashboard, "points" | "energy" | "hours" | "period" | "rangeStart" | "rangeEnd">) {
  const hasReadings = points.filter((point) => point.charge !== null).length >= 2;
  const readings = hasReadings ? points.map((point) => ({ ...point, timestamp: Date.parse(point.time) })) : [];
  const timeAxis = {
    dataKey: "timestamp", type: "number" as const, scale: "time" as const,
    domain: [Date.parse(rangeStart), Date.parse(rangeEnd)], allowDataOverflow: true,
    tickFormatter: (value: number) => timeLabel(value, hours), minTickGap: 36, tickLine: false, axisLine: false,
  };

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6" aria-label="Battery charge history">
        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-medium">Battery level</h3>
          <p className="mt-1 text-xs text-muted-foreground">State of charge over time</p>
        </div>
        <ChartFrame available={hasReadings} className="h-44 sm:h-60">
        <ChartContainer config={socConfig} className="h-full w-full aspect-auto" role="img" aria-label="Battery charge percentage over time">
          <AreaChart data={readings} margin={{ left: -20, right: 8 }}>
            <defs><linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-soc)" stopOpacity={0.35}/><stop offset="95%" stopColor="var(--color-soc)" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis} />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} labelFormatter={tooltipTimeLabel} />
            <Area dataKey="soc" type="monotone" stroke="var(--color-soc)" fill="url(#socFill)" strokeWidth={2} dot={{ r: 1.5, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
        </ChartFrame>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6" aria-label="Battery power history">
        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-medium">Power over time</h3>
          <p className="mt-1 text-xs text-muted-foreground">Charging, discharging and solar power · W</p>
        </div>
        <ChartFrame available={hasReadings} className="h-48 sm:h-60">
        <ChartContainer config={powerConfig} className="h-full w-full aspect-auto" role="img" aria-label="Charge, discharge and solar power over time">
          <AreaChart data={readings} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={axisValue} width={44} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{powerLabels[String(name)] ?? String(name)}</span><span className="ml-auto font-mono font-medium tabular-nums">{unitValue(value, "W")}</span></>} />} labelFormatter={tooltipTimeLabel} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="charge" type="monotone" stroke="var(--color-charge)" fill="var(--color-charge)" fillOpacity={0.1} strokeWidth={2} dot={{ r: 1.5, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
            <Area dataKey="discharge" type="monotone" stroke="var(--color-discharge)" fill="var(--color-discharge)" fillOpacity={0.1} strokeWidth={2} dot={{ r: 1.5, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
            <Area dataKey="pv" type="monotone" stroke="var(--color-pv)" fill="transparent" strokeWidth={1.5} dot={{ r: 1.5, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
        </ChartFrame>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6 xl:col-span-2" aria-label="Charged and discharged energy">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-5">
          <div><h3 className="text-sm font-medium">Energy moved</h3><p className="mt-1 text-xs text-muted-foreground">Estimated from sampled power · Wh per {hours <= 24 ? "hour" : "day"}</p></div>
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-10">
            <div><p className="energy-eyebrow">Charged in period</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-emerald-300">{hasReadings ? period.chargeWh.toLocaleString("en-US") : "—"} <span className="text-xs font-normal">Wh</span></p></div>
            <div><p className="energy-eyebrow">Discharged in period</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-sky-300">{hasReadings ? period.dischargeWh.toLocaleString("en-US") : "—"} <span className="text-xs font-normal">Wh</span></p></div>
          </div>
        </div>
        <ChartFrame available={hasReadings && energy.length > 0} className="h-48 sm:h-64">
        <ChartContainer config={energyConfig} className="h-full w-full aspect-auto" role="img" aria-label="Charged and discharged energy by time period">
          <BarChart data={energy} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={axisValue} width={44} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{energyLabels[String(name)] ?? String(name)}</span><span className="ml-auto font-mono font-medium tabular-nums">{unitValue(value, "Wh")}</span></>} />} labelFormatter={(_, payload) => timeLabel(payload[0]?.payload.time ?? "", hours)} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="chargeWh" fill="var(--color-chargeWh)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="dischargeWh" fill="var(--color-dischargeWh)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        </ChartFrame>
      </section>
    </div>
  );
}

function ChartFrame({ available, className, children }: { available: boolean; className: string; children: ReactNode }) {
  return <div className={`relative min-w-0 ${className}`}>{children}{!available && <div role="status" className="absolute inset-0 grid place-items-center rounded-lg bg-card/95 px-5 text-center text-xs text-muted-foreground">Not enough readings for this period.</div>}</div>;
}
