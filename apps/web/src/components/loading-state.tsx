import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div role="status" aria-live="polite" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>;
}

export function OptionListSkeleton({ rows = 6, compact = false }: { rows?: number; compact?: boolean }) {
  return <div className="space-y-3">
    <Skeleton className="h-3 w-28" />
    <div className={compact ? "grid grid-cols-2 gap-1 sm:block sm:space-y-1" : "space-y-1"}>{Array.from({ length: rows }, (_, index) => <div key={index} className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2.5">
      <Skeleton className="size-4 shrink-0 rounded-sm" />
      <Skeleton className={`h-4 ${index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-1/2" : "w-3/4"}`} />
    </div>)}</div>
  </div>;
}

export function NotificationListSkeleton() {
  return <LoadingState label="Loading notifications" className="space-y-2">
    {Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-3 rounded-lg border p-2.5 sm:p-3">
      <Skeleton className="h-5 w-16 rounded-full" />
      <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
      <Skeleton className="h-3 w-32" /><Skeleton className="h-11 w-24 sm:h-7" />
    </div>)}
  </LoadingState>;
}
