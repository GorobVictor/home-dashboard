import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { controlClassName } from "@/lib/ui-layout";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(controlClassName, "h-auto min-h-28 resize-y leading-6", className)} {...props} />;
}
