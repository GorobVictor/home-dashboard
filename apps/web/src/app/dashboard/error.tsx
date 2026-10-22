"use client";

import { PageError } from "@/components/page-error";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <PageError title="Dashboard unavailable" description="We could not load your dashboard." reset={reset} />;
}
