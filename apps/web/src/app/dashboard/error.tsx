"use client";

import { PageError } from "@/components/page-error";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <PageError title="Дашборд недоступний" description="Не вдалося завантажити дашборд." reset={reset} />;
}
