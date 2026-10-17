import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <span className={cn("relative inline-flex size-4 shrink-0 align-middle", className)}>
    <input {...props} type="checkbox" className="peer size-full cursor-pointer appearance-none rounded-sm border border-input bg-input/30 transition-colors checked:border-emerald-400 checked:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40" />
    <Check aria-hidden="true" className="pointer-events-none absolute inset-0 size-4 p-0.5 text-emerald-950 opacity-0 peer-checked:opacity-100" strokeWidth={3} />
  </span>;
}
