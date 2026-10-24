"use client";

import { PageError } from "@/components/page-error";

export default function LoginError({ reset }: { reset: () => void }) {
  return <PageError standalone title="Вхід недоступний" description="Не вдалося завантажити сторінку входу." reset={reset} />;
}
