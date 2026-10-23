"use client";
import { PageError } from "@/components/page-error";
export default function ErrorPage({ reset }: { reset: () => void }) { return <PageError title="Сповіщення недоступні" description="Не вдалося завантажити налаштування сповіщень." reset={reset} />; }
