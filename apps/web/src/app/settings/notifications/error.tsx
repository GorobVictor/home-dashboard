"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4 p-8"><p>Could not load notification settings.</p><Button onClick={reset}>Try again</Button></div>; }
