"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardSkeleton } from "@/components/page-skeletons";

function DashboardLoadingContent() {
  const params = useSearchParams();
  return <DashboardSkeleton tab={params.get("tab") ?? "energy"} />;
}

export default function DashboardLoading() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardLoadingContent /></Suspense>;
}
