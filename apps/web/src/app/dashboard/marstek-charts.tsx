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
import { chartDate, timeZone } from "@/lib/dates";

type Dashboard = Awaited<ReturnType<typeof getMarstekDashboard>>;

const socConfig = { soc: { label: "Заряд", color: "var(--chart-1)" } } satisfies ChartConfig;
const powerConfig = {
  charge: { label: "Заряджання", color: "var(--chart-2)" },
  discharge: { label: "Розряджання", color: "var(--chart-4)" },
  pv: { label: "Сонце", color: "var(--chart-3)" },
} satisfies ChartConfig;
const energyConfig = {
  chargeWh: { label: "Заряджено", color: "var(--chart-2)" },
  dischargeWh: { label: "Віддано", color: "var(--chart-4)" },
} satisfies ChartConfig;

function timeLabel(value: string | number, hours: number) {
  const date = new Date(value);
  return hours <= 24
    ? date.toLocaleTimeString("uk-UA", { timeZone, hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("uk-UA", { timeZone, month: "short", day: "numeric" });
}

const tooltipTimeLabel = chartDate;

function unitValue(value: unknown, unit: string) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number).toLocaleString("uk-UA")} ${unit}` : "—";
}

const axisValue = (value: number) => value.toLocaleString("uk-UA", { notation: "compact", maximumFractionDigits: 1 });

const powerLabels: Record<string, string> = { charge: "Заряджання", discharge: "Розряджання", pv: "Сонце" };
const energyLabels: Record<string, string> = { chargeWh: "Заряджено", dischargeWh: "Віддано" };

export function MarstekCharts({ points, energy, hours, period, rangeStart, rangeEnd }: Pick<Dashboard, "points" | "energy" | "hours" | "period" | "rangeStart" | "rangeEnd">) {
  const hasReadings = points.filter(point => point.charge !== null).length >= 2;
  const hasEnergy = energy.some(bucket => bucket.chargeWh !== null);
  const readings = points.map((point) => ({ ...point, timestamp: Date.parse(point.time) }));
  const timeAxis = {
    dataKey: "timestamp", type: "number" as const, scale: "time" as const,
    domain: [Date.parse(rangeStart), Date.parse(rangeEnd)], allowDataOverflow: true,
    tickFormatter: (value: number) => timeLabel(value, hours), minTickGap: 36, tickLine: false, axisLine: false,
  };

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6" aria-label="Історія заряду батареї">
        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-medium">Рівень заряду</h3>
          <p className="mt-1 text-xs text-muted-foreground">Зміна заряду в часі</p>
        </div>
        <ChartFrame available={points.filter(point => point.soc !== null).length >= 2} className="h-44 sm:h-60">
        <ChartContainer config={socConfig} className="h-full w-full aspect-auto" role="img" aria-label="Заряд батареї в часі">
          <AreaChart data={readings} margin={{ left: -20, right: 8 }}>
            <defs><linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-soc)" stopOpacity={0.35}/><stop offset="95%" stopColor="var(--color-soc)" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis} />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipTimeLabel} formatter={value => <span>{Number(value).toFixed(1)} %</span>} />} labelFormatter={tooltipTimeLabel} />
            <Area dataKey="soc" type="monotone" stroke="var(--color-soc)" fill="url(#socFill)" strokeWidth={2} dot={{ r: 1.5, strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
        </ChartFrame>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6" aria-label="Історія потужності батареї">
        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-medium">Потужність у часі</h3>
          <p className="mt-1 text-xs text-muted-foreground">Заряд, розряд і сонячна потужність · W</p>
        </div>
        <ChartFrame available={hasReadings} className="h-48 sm:h-60">
        <ChartContainer config={powerConfig} className="h-full w-full aspect-auto" role="img" aria-label="Заряд, розряд і сонячна потужність у часі">
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
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6 xl:col-span-2" aria-label="Температура батареї">
        <h3 className="text-sm font-medium">Температура батареї</h3><p className="mt-1 mb-4 text-xs text-muted-foreground">°C · Київ · пропуски даних залишаються розривами</p>
        <ChartFrame available={points.filter(point => point.temperature !== null).length >= 2} className="h-48 sm:h-60">
          <ChartContainer config={{ temperature: { label: "Температура", color: "var(--chart-3)" } }} className="h-full w-full aspect-auto" role="img" aria-label="Температура батареї за вибраний період">
            <AreaChart data={readings} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis {...timeAxis} /><YAxis tickFormatter={value => `${value}°`} domain={["auto", "auto"]} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={chartDate} formatter={value => <span>{Number(value).toFixed(1)} °C</span>} />} labelFormatter={chartDate} />
              <Area dataKey="temperature" type="linear" stroke="var(--color-temperature)" fill="var(--color-temperature)" fillOpacity={0.1} connectNulls={false} isAnimationActive={false} />
            </AreaChart>
          </ChartContainer>
        </ChartFrame>
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-3 sm:p-6 xl:col-span-2" aria-label="Заряджена й віддана енергія">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-5">
          <div><h3 className="text-sm font-medium">Передана енергія</h3><p className="mt-1 text-xs text-muted-foreground">Оцінено з потужності · Wh за {hours <= 24 ? "годину" : "день"}</p></div>
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-10">
            <div><p className="energy-eyebrow">Заряджено за період</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-emerald-300">{hasEnergy ? period.chargeWh.toLocaleString("uk-UA") : "—"} <span className="text-xs font-normal">Wh</span></p></div>
            <div><p className="energy-eyebrow">Віддано за період</p><p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-sky-300">{hasEnergy ? period.dischargeWh.toLocaleString("uk-UA") : "—"} <span className="text-xs font-normal">Wh</span></p></div>
          </div>
        </div>
        <ChartFrame available={hasEnergy} className="h-48 sm:h-64">
        <ChartContainer config={energyConfig} className="h-full w-full aspect-auto" role="img" aria-label="Енергія за період">
          <BarChart data={energy} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={axisValue} width={44} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{energyLabels[String(name)] ?? String(name)}</span><span className="ml-auto font-mono font-medium tabular-nums">{unitValue(value, "Wh")}</span></>} />} labelFormatter={chartDate} />
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
  return <div className={`relative min-w-0 ${className}`}>{children}{!available && <div role="status" className="absolute inset-0 grid place-items-center rounded-lg bg-card/95 px-5 text-center text-xs text-muted-foreground">Недостатньо вимірювань за цей період.</div>}</div>;
}
