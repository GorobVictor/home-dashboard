"use client";
import { PageError } from "@/components/page-error";
export default function ErrorPage({ reset }: { reset: () => void }) { return <PageError title="Журнал подій недоступний" description="Could not load the event log." reset={reset} />; }
