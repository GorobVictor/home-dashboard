"use client";

import { Button } from "@/components/ui/button";

export function PageError({ title, description, reset }: { title: string; description: string; reset: () => void }) {
  return <div className="dashboard-shell min-h-dvh"><main className="mx-auto flex min-h-dvh w-full max-w-7xl items-center px-3 py-8 sm:px-8">
    <div className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-5 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p role="alert" className="text-sm leading-6 text-muted-foreground">{description}</p>
      <Button variant="outline" className="min-h-11" onClick={reset}>Try again</Button>
    </div>
  </main></div>;
}
