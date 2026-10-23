"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { headerLogoutButtonClassName } from "@/lib/ui-layout";
import { ActionTooltip } from "@/components/help-text";

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
      try { localStorage.setItem("home-dashboard:logout", String(Date.now())); } catch { /* Session cookie is still cleared. */ }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Не вдалося вийти. Повторіть спробу.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ActionTooltip help="Завершити вхід у цьому браузері, включно з іншими відкритими вкладками дашборда."><Button className={headerLogoutButtonClassName} variant="outline" onClick={logout} disabled={pending} aria-label={pending ? "Виходимо…" : "Вийти"}>
        <LogOut aria-hidden="true" className="size-4 sm:hidden" /><span className="hidden sm:inline">{pending ? "Виходимо…" : "Вийти"}</span>
      </Button></ActionTooltip>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
