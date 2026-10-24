"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/help-text";

export function RefreshButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const interval = setInterval(() => startTransition(() => router.refresh()), 60_000);
    return () => clearInterval(interval);
  }, [router]);
  return (
    <ActionTooltip help="Завантажити актуальні дані цього розділу. Це не запускає позачергове опитування Freelancehunt чи батареї."><Button aria-label="Оновити" variant="outline" size={compact ? "icon" : "sm"} onClick={() => startTransition(() => router.refresh())} disabled={pending}>
      <RefreshCw className={pending ? "motion-safe:animate-spin" : ""} aria-hidden="true" />
      {!compact && "Оновити"}
    </Button></ActionTooltip>
  );
}
