"use client";

import { PageError } from "@/components/page-error";

export default function LoginError({ reset }: { reset: () => void }) {
  return <PageError title="Sign in unavailable" description="Could not load the sign-in page." reset={reset} />;
}
