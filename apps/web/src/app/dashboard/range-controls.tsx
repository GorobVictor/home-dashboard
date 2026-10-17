"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ranges = [{ label: "1h", hours: 1 }, { label: "6h", hours: 6 }, { label: "24h", hours: 24 }, { label: "7d", hours: 168 }, { label: "30d", hours: 720 }];

export function RangeControls({ deviceId, activeHours, rangeStart, rangeEnd }: { deviceId: string; activeHours: number; rangeStart: string; rangeEnd: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(rangeStart.slice(0, 10));
  const [to, setTo] = useState(rangeEnd.slice(0, 10));
  const isCustom = searchParams.has("from") || searchParams.has("to");
  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    params.set("device", deviceId);
    router.push(`/dashboard?${params.toString()}`);
  };
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/30 p-1 sm:w-fit" role="group" aria-label="History time range">
      {ranges.map((range) => <Button key={range.hours} className="min-h-11 sm:min-w-14" size="sm" aria-pressed={!isCustom && activeHours === range.hours} variant={!isCustom && activeHours === range.hours ? "secondary" : "ghost"} onClick={() => navigate({ range: String(range.hours), from: null, to: null })}>{range.label}</Button>)}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); navigate({ range: null, from, to }); }} className="grid min-w-0 grid-cols-2 items-end gap-3 rounded-xl border bg-card p-3 sm:flex sm:flex-wrap sm:p-4">
      <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">From<Input className="h-11 min-w-0 max-w-full text-sm sm:w-40" type="date" required value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">To<Input className="h-11 min-w-0 max-w-full text-sm sm:w-40" type="date" required value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
      <Button type="submit" className="col-span-2 min-h-11 sm:px-5" variant={isCustom ? "secondary" : "outline"}>Apply dates</Button>
    </form>
  </div>;
}
