"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardSkeleton } from "@/components/page-skeletons";
import { useSavedView } from "@/components/use-saved-view";
import { viewPreferences } from "@/lib/view-preferences";

function DashboardLoadingContent() {
  const params = useSearchParams();
  const [projectView] = useSavedView(viewPreferences.projects, "cards");
  return <DashboardSkeleton tab={params.get("tab") ?? "energy"} projectView={projectView} />;
}

export default function DashboardLoading() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardLoadingContent /></Suspense>;
}
