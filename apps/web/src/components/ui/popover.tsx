"use client";

import { Popover as Primitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverTitle = Primitive.Title;
export function PopoverContent({ className, ...props }: Primitive.Popup.Props) {
  return <Primitive.Portal><Primitive.Positioner sideOffset={8} align="end" className="z-50"><Primitive.Popup className={cn("w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none", className)} {...props} /></Primitive.Positioner></Primitive.Portal>;
}
