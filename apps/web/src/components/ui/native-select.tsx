import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClassName } from "@/lib/ui-layout";

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return <div className="relative min-w-0"><select data-slot="native-select" className={cn(controlClassName, "appearance-none pr-10", className)} {...props}>{children}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" /></div>;
}
