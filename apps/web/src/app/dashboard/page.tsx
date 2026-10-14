import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUser } from "@/server/auth/session";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Home Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.firstName}</h1>
        </div>
        <LogoutButton />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>Your private dashboard is ready.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="text-muted-foreground">Name:</span> {user.firstName} {user.lastName}</p>
          <p><span className="text-muted-foreground">Login:</span> {user.login}</p>
        </CardContent>
      </Card>
    </main>
  );
}
