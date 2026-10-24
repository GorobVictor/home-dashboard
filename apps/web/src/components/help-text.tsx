"use client";

import { useId, useRef, useState, type ReactElement } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { helpDescriptions } from "@/lib/help";

/** Inline help works inside labels without submitting forms or toggling controls. */
export function HelpText({ children, help }: { children: string; help?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pressedOpen = useRef(false);
  const description = help ?? helpDescriptions[children];
  if (!description) return <>{children}</>;
  return <span className="inline-flex max-w-full items-start gap-1.5 align-middle leading-6">{children}{" "}<Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger delay={200} closeOnClick={false} aria-label={`Пояснення: ${children}`} aria-describedby={open ? id : undefined} render={<span role="button" tabIndex={0} />} className="inline-flex size-6 shrink-0 cursor-help touch-manipulation items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onPointerDown={() => { pressedOpen.current = open; }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(!pressedOpen.current); }}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setOpen(true); } }}>
      <CircleHelp aria-hidden="true" className="size-3.5" />
    </TooltipTrigger>
    <TooltipContent id={id} className="max-w-[min(22rem,calc(100vw-2rem))] text-left text-sm font-normal leading-5">{description}</TooltipContent>
  </Tooltip></span>;
}

/** Adds hover/focus help to an existing action without adding a nested button. */
export function ActionTooltip({ children, help }: { children: ReactElement; help: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger render={children} delay={200} aria-describedby={open ? id : undefined} /><TooltipContent id={id} className="max-w-[min(22rem,calc(100vw-2rem))] text-sm font-normal leading-5">{help}</TooltipContent></Tooltip>;
}
