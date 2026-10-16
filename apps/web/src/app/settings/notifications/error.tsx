"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4 p-8"><p>Не вдалося завантажити налаштування сповіщень.</p><Button onClick={reset}>Повторити</Button></div>; }
