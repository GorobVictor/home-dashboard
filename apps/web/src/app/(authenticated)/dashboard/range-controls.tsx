"use client";

import { HelpText } from "@/components/help-text";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ranges = [{ label: "1h", hours: 1 }, { label: "6h", hours: 6 }, { label: "24h", hours: 24 }, { label: "7d", hours: 168 }, { label: "30d", hours: 720 }];

export function RangeControls({ deviceId, activeHours, rangeStart, rangeEnd }: { deviceId: string; activeHours: number; rangeStart: string; rangeEnd: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(rangeStart.slice(0, 10));
  const [to, setTo] = useState(rangeEnd.slice(0, 10));
  const isCustom = searchParams.has("from") || searchParams.has("to");
  const [customOpen, setCustomOpen] = useState(isCustom);
  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    params.set("device", deviceId);
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };
  return <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
    <div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/30 p-1 sm:w-fit" role="group" aria-label="Період історії">
      {ranges.map((range) => <Button key={range.hours} className="min-h-11 sm:min-w-14" size="sm" aria-pressed={!isCustom && activeHours === range.hours} variant={!isCustom && activeHours === range.hours ? "secondary" : "ghost"} onClick={() => navigate({ range: String(range.hours), from: null, to: null })}>{range.label}</Button>)}
    </div>
    <Button type="button" variant="ghost" aria-expanded={customOpen} aria-controls="custom-history-dates" className="justify-start gap-2 px-2 text-xs text-muted-foreground sm:hidden" onClick={() => setCustomOpen(!customOpen)}><CalendarDays className="size-4" />{isCustom ? `${rangeStart.slice(0, 10)} – ${rangeEnd.slice(0, 10)}` : "Власний період"}<ChevronDown className={`ml-auto size-4 transition-transform ${customOpen ? "rotate-180" : ""}`} /></Button>
    <form id="custom-history-dates" onSubmit={(event) => { event.preventDefault(); navigate({ range: null, from, to }); }} className={`${customOpen ? "grid" : "hidden"} min-w-0 grid-cols-1 items-end gap-4 rounded-2xl border bg-card p-4 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap sm:p-5`}>
      <label className="form-field"><HelpText>З (UTC)</HelpText><Input aria-label="З (UTC)" className="sm:w-44" type="date" required value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="form-field"><HelpText>До (UTC)</HelpText><Input aria-label="До (UTC)" className="sm:w-44" type="date" required value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      <Button type="submit" className="min-[480px]:col-span-2 sm:px-5" variant={isCustom ? "secondary" : "outline"}>Застосувати дати</Button>
    </form>
  </div>;
}
