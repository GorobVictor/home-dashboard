"use client";

import { PageError } from "@/components/page-error";

export default function SettingsError({ reset }: { reset: () => void }) {
  return <PageError title="Settings unavailable" description="Could not load your settings." reset={reset} />;
}
