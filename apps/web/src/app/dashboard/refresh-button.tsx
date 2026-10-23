"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const interval = setInterval(() => startTransition(() => router.refresh()), 60_000);
    return () => clearInterval(interval);
  }, [router]);
  return (
    <Button variant="outline" size="sm" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
      <RefreshCw className={pending ? "motion-safe:animate-spin" : ""} aria-hidden="true" />
      Оновити
    </Button>
  );
}
