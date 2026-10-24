import type { ReactNode } from "react";

export function EnergyOverview({ battery, flow }: { battery: ReactNode; flow: ReactNode }) {
  return <section aria-label="Поточний стан енергії" className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><div className="min-w-0 [&>div]:h-full">{battery}</div><div className="min-w-0 [&>div]:h-full">{flow}</div></section>;
}
