"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileDisclosure({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className="min-w-0 rounded-2xl border bg-card">
    <Button type="button" variant="ghost" className="w-full justify-start gap-2 h-14 rounded-2xl px-4 text-sm sm:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><SlidersHorizontal className="size-4 text-muted-foreground" />{label}<ChevronDown className={`ml-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button>
    <div id={id} className={`${open ? "block border-t" : "hidden"} p-4 sm:block sm:border-0 sm:p-6`}>{children}</div>
  </div>;
}
