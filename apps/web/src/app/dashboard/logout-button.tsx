"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button className="size-11 sm:h-9 sm:w-auto" variant="outline" onClick={logout} disabled={pending} aria-label={pending ? "Signing out…" : "Sign out"}>
        <LogOut aria-hidden="true" className="size-4 sm:hidden" /><span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
