"use client";
import { PageError } from "@/components/page-error";
export default function ErrorPage({ reset }: { reset: () => void }) { return <PageError title="Notifications unavailable" description="Could not load notification settings." reset={reset} />; }
