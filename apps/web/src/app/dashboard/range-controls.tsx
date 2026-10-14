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
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"><div className="flex w-full overflow-x-auto rounded-lg border bg-muted/30 p-1 text-sm sm:w-auto">
    {ranges.map((range) => <Button key={range.hours} size="sm" variant={!isCustom && activeHours === range.hours ? "secondary" : "ghost"} onClick={() => navigate({ range: String(range.hours), from: null, to: null })}>{range.label}</Button>)}
  </div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap"><Input aria-label="Custom range start date" className="min-w-0 sm:w-36" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /><span className="text-center text-sm text-muted-foreground">to</span><Input aria-label="Custom range end date" className="min-w-0 sm:w-36" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /><Button className="col-span-3 sm:col-span-1" size="sm" variant={isCustom ? "secondary" : "outline"} onClick={() => navigate({ range: null, from, to })}>Custom</Button></div></div>;
}
