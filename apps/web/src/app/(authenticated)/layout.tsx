import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { PageHeader } from "@/components/page-header";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <div className="dashboard-shell min-h-dvh">
    <div className="app-container">
      <PageHeader userId={user.id} firstName={user.firstName} />
      <main id="main-content" className="page-content">{children}</main>
    </div>
  </div>;
}
