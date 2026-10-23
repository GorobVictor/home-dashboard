"use client";

import { HelpText } from "@/components/help-text";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, BatteryFull, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: form.get("login"),
          password: form.get("password"),
        }),
      });

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Неправильний логін або пароль."
            : response.status === 429
              ? `Забагато спроб. Повторіть через ${response.headers.get("Retry-After") ?? "60"} с.`
            : response.status === 400
              ? "Введіть коректний логін і пароль."
              : "Вхід тимчасово недоступний. Повторіть спробу.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Не вдалося з’єднатися із сервером. Повторіть спробу.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="dashboard-shell flex min-h-dvh items-center justify-center px-3 py-6 sm:px-4 sm:py-16">
      <div className="w-full max-w-sm space-y-5 sm:space-y-7">
        <div className="flex items-center justify-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10"><BatteryFull aria-hidden="true" className="size-5 text-emerald-300" /></div>
          <div><p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Home Dashboard</p><p className="mt-1 text-sm text-muted-foreground">Енергія та робочий простір</p></div>
        </div>
        <Card className="rounded-2xl py-5 [--card-spacing:--spacing(4)] sm:py-7 sm:[--card-spacing:--spacing(7)]">
          <CardHeader className="pb-2">
            <h1 className="text-2xl font-semibold tracking-tight">З поверненням.</h1>
            <CardDescription className="mt-1">Увійдіть до свого дашборда.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4 sm:space-y-5" aria-busy={pending}>
              <div className="space-y-2">
                <label htmlFor="login" className="text-sm font-medium"><HelpText>Логін</HelpText></label>
                <Input aria-label="Логін" id="login" name="login" autoComplete="username" required minLength={3} maxLength={50} placeholder="Ваш логін" className="h-11 rounded-xl px-3.5" />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium"><HelpText>Пароль</HelpText></label>
                <Input aria-label="Пароль" id="password" name="password" type="password" autoComplete="current-password" required placeholder="Ваш пароль" className="h-11 rounded-xl px-3.5" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending} className="h-11 w-full gap-2 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                {pending ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : null}
                {pending ? "Входимо…" : "Увійти"}
                {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
