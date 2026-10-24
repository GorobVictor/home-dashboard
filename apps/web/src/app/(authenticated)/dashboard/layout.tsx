import type { ReactNode } from "react";
import { listFreelancehuntProjects } from "@home-dashboard/database";
import { DashboardTabs } from "@/components/dashboard-tabs";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { total } = await listFreelancehuntProjects(1, 1);
  return <><DashboardTabs total={total} /><div className="page-loading">{children}</div></>;
}
