"use client";

import { Button } from "@/components/ui/button";

export function PageError({ title, description, reset, standalone = false }: { title: string; description: string; reset: () => void; standalone?: boolean }) {
  const Heading = standalone ? "h1" : "h2";
  const content = <div className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-5 sm:p-8">
      <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
      <p role="alert" className="text-sm leading-6 text-muted-foreground">{description}</p>
      <Button variant="outline" className="min-h-11" onClick={reset}>Повторити</Button>
    </div>;
  return standalone ? <main className="dashboard-shell grid min-h-dvh place-items-center px-4 py-8">{content}</main> : content;
}
