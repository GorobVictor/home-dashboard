"use client";

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

function timeLabel(value: string, hours: number) {
  const date = new Date(value);
  return hours <= 24
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MarstekCharts({ points, energy, hours, period }: Pick<Dashboard, "points" | "energy" | "hours" | "period">) {
  if (points.length < 2) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        Charts will appear after the worker has collected at least two readings.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6" aria-label="Battery charge history">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Battery level</h3>
          <p className="mt-1 text-xs text-muted-foreground">State of charge over time</p>
        </div>
        <ChartContainer config={socConfig} className="h-60 w-full aspect-auto" role="img" aria-label="Battery charge percentage over time">
          <AreaChart data={points} margin={{ left: -20, right: 8 }}>
            <defs><linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-soc)" stopOpacity={0.35}/><stop offset="95%" stopColor="var(--color-soc)" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={(value: string) => timeLabel(value, hours)} minTickGap={36} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(value) => timeLabel(String(value), hours)} />
            <Area dataKey="soc" type="monotone" stroke="var(--color-soc)" fill="url(#socFill)" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6" aria-label="Battery power history">
        <div className="mb-4">
          <h3 className="text-sm font-medium">Power over time</h3>
          <p className="mt-1 text-xs text-muted-foreground">Charging, discharging and solar power · W</p>
        </div>
        <ChartContainer config={powerConfig} className="h-60 w-full aspect-auto" role="img" aria-label="Charge, discharge and solar power over time">
          <AreaChart data={points} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={(value: string) => timeLabel(value, hours)} minTickGap={36} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(value) => timeLabel(String(value), hours)} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="charge" type="monotone" stroke="var(--color-charge)" fill="var(--color-charge)" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            <Area dataKey="discharge" type="monotone" stroke="var(--color-discharge)" fill="var(--color-discharge)" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            <Area dataKey="pv" type="monotone" stroke="var(--color-pv)" fill="transparent" strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6 xl:col-span-2" aria-label="Charged and discharged energy">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div><h3 className="text-sm font-medium">Energy moved</h3><p className="mt-1 text-xs text-muted-foreground">Estimated from sampled power · Wh per {hours <= 24 ? "hour" : "day"}</p></div>
          <div className="flex gap-6 sm:gap-10">
            <div><p className="energy-eyebrow">Charged in period</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-emerald-300">{period.chargeWh.toLocaleString("en-US")} <span className="text-xs font-normal">Wh</span></p></div>
            <div><p className="energy-eyebrow">Discharged in period</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-sky-300">{period.dischargeWh.toLocaleString("en-US")} <span className="text-xs font-normal">Wh</span></p></div>
          </div>
        </div>
        <ChartContainer config={energyConfig} className="h-64 w-full aspect-auto" role="img" aria-label="Charged and discharged energy by time period">
          <BarChart data={energy} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={(value: string) => timeLabel(value, hours)} minTickGap={24} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(value) => timeLabel(String(value), hours)} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="chargeWh" fill="var(--color-chargeWh)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="dischargeWh" fill="var(--color-dischargeWh)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </section>
    </div>
  );
}
