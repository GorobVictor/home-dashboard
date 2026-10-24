"use client";

import { PageError } from "@/components/page-error";

export default function AuthenticatedError({ reset }: { reset: () => void }) {
  return <PageError title="Сторінка недоступна" description="Не вдалося завантажити дані. Спробуйте ще раз." reset={reset} />;
}
