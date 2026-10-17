"use client";

import { useRef, useState, type ReactNode } from "react";

const cards = ["Battery", "Energy flow"];

export function EnergyOverview({ battery, flow }: { battery: ReactNode; flow: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function showCard(index: number) {
    const element = viewport.current;
    if (element) element.scrollTo({ left: index === 0 ? 0 : element.scrollWidth - element.clientWidth });
  }

  return <section aria-label="Live energy overview" className="flex min-w-0 flex-col gap-4">
    <div ref={viewport} onScroll={(event) => {
      const element = event.currentTarget;
      setActive(element.scrollLeft > (element.scrollWidth - element.clientWidth) / 2 ? 1 : 0);
    }} className="grid snap-x snap-mandatory auto-cols-[100%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain p-px motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:snap-none lg:grid-flow-row lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:overflow-visible">
      <div role="group" aria-label="Battery" className="min-w-0 snap-start snap-always scroll-mx-1 [&>div]:h-full">{battery}</div>
      <div role="group" aria-label="Energy flow" className="min-w-0 snap-start snap-always scroll-mx-1 [&>div]:h-full">{flow}</div>
    </div>
    <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/30 p-1 lg:hidden" role="group" aria-label="Choose energy card">
      {cards.map((label, index) => <button key={label} type="button" aria-pressed={active === index} onClick={() => showCard(index)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active === index ? "bg-emerald-400/10 text-emerald-300" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
    </div>
  </section>;
}
