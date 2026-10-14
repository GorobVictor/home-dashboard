"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
      <p role="alert" className="text-muted-foreground">We could not load your dashboard.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
