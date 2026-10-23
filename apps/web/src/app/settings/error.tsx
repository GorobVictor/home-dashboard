"use client";

import { PageError } from "@/components/page-error";

export default function SettingsError({ reset }: { reset: () => void }) {
  return <PageError title="Налаштування недоступні" description="Не вдалося завантажити налаштування." reset={reset} />;
}
