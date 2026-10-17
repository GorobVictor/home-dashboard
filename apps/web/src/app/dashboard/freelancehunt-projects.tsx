"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoreReason, ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface FreelancehuntProjectView {
  id: number; name: string; description: string | null; url: string;
  budgetAmount: number | null; budgetCurrency: string | null; skills: string[];
  categories?: string[]; discoveredAt: string; publishedAt: string | null;
  score: number; reasons: ScoreReason[]; saved: boolean; hidden: boolean; viewed: boolean; notes: string;
}
interface LiveProject {
  name: string; description: string | null; url: string; budgetAmount: number | null;
  budgetCurrency: string | null; skills: string[]; status: string | null; bidCount: number | null; expiresAt: string | null;
}
export function FreelancehuntProjects({ projects }: { projects: FreelancehuntProjectView[] }) {
  const [active, setActive] = useState<FreelancehuntProjectView | null>(null);
  const visible = active && !projects.some((p) => p.id === active.id) ? [...projects, active] : projects;
  if (!visible.length) return <Card className="border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">Немає проєктів за вибраними фільтрами. Змініть фільтри або увімкніть моніторинг Freelancehunt у Settings.</CardContent></Card>;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((project) => <ProjectCard key={project.id} project={project} onActive={(open) => setActive(open ? project : null)} />)}</div>;
}
const budgetLabel = (project: { budgetAmount: number | null; budgetCurrency: string | null }) => project.budgetAmount === null ? "Бюджет не вказано" : `${project.budgetAmount.toLocaleString("uk-UA")} ${project.budgetCurrency ?? ""}`;
const dateLabel = (date: string) => new Date(date).toLocaleString("uk-UA", { timeZone: "UTC" });

function ProjectCard({ project, onActive }: { project: FreelancehuntProjectView; onActive: (open: boolean) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [live, setLive] = useState<LiveProject | null>(null);
  const [loading, setLoading] = useState(false), [detailsError, setDetailsError] = useState("");
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const [notes, setNotes] = useState(project.notes), [noteMessage, setNoteMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [localState, setLocalState] = useState<Partial<Pick<FreelancehuntProjectView, "saved" | "hidden" | "viewed">>>({});
  const state = { ...project, ...localState };
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/freelancehunt/projects/${project.id}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 429 ? "Ліміт Freelancehunt API. Спробуйте пізніше." : response.status === 404 ? "Проєкт більше недоступний на Freelancehunt." : "Не вдалося оновити деталі. Показано дані з БД.");
      const result: LiveProject = await response.json();
      if (!controller.signal.aborted) setLive(result);
    }).catch((error) => { if (!controller.signal.aborted) setDetailsError(error instanceof Error ? error.message : "Не вдалося оновити деталі."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, project.id, retry]);
  async function mutate(patch: ProjectStatePatch) {
    setBusy(true); setActionError(""); setNoteMessage("");
    try {
      const response = await fetch(`/api/freelancehunt/projects/${project.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error("Не вдалося зберегти зміни. Повторіть спробу.");
      setLocalState((previous) => ({ ...previous, ...(patch.saved === undefined ? {} : { saved: patch.saved }), ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }), ...(patch.viewed ? { viewed: true } : {}) }));
      if (patch.notes !== undefined) setNoteMessage("Нотатку збережено.");
      router.refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Помилка запиту."); }
    finally { setBusy(false); }
  }
  function changeOpen(next: boolean) {
    setOpen(next);
    onActive(next);
    if (next) { setLive(null); setLoading(true); setDetailsError(""); if (!state.viewed) void mutate({ viewed: true }); }
  }
  const details = live ?? project;
  return <Dialog open={open} onOpenChange={changeOpen}>
    <Card className={`flex h-full flex-col ${!state.viewed ? "border-primary/40" : ""}`}>
      <DialogTrigger disabled={busy} render={<button type="button" aria-label={`Деталі проєкту: ${project.name}`} className="flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />}>
        <CardHeader className="pb-2"><div className="mb-2 flex flex-wrap gap-2"><Badge variant={project.score >= 80 ? "default" : "secondary"}>{project.score}/100</Badge>{!state.viewed && <Badge variant="outline">Новий</Badge>}{state.saved && <Badge variant="outline">Збережений</Badge>}{state.hidden && <Badge variant="outline">Прихований</Badge>}</div><CardTitle className="line-clamp-2 text-base">{project.name}</CardTitle><CardDescription>{budgetLabel(project)}</CardDescription></CardHeader><CardContent><p className="line-clamp-3 text-sm text-muted-foreground">{project.description ?? "Опис відсутній."}</p><p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{project.skills.join(", ") || "Навички не вказані"}</p><p className="mt-2 text-xs text-muted-foreground">{project.publishedAt ? `Опубліковано: ${dateLabel(project.publishedAt)} UTC` : "Дата публікації невідома"}</p></CardContent>
      </DialogTrigger>
      <div className="flex flex-wrap gap-1 px-4 pb-4"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Не зберігати" : "Зберегти"}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Відновити" : "Приховати"}</Button>{!state.viewed && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ viewed: true })}>Переглянуто</Button>}</div>
      {actionError && !open && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{actionError}</p>}
    </Card>
    <DialogContent className="dark dashboard-dialog max-h-[calc(100vh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
      <DialogHeader><DialogTitle className="pr-7 leading-snug">{details.name}</DialogTitle><DialogDescription>{budgetLabel(details)} · Знайдено {dateLabel(project.discoveredAt)} UTC</DialogDescription></DialogHeader>
      <div aria-live="polite" className="text-sm text-muted-foreground">{loading ? "Оновлення деталей із Freelancehunt…" : detailsError ? <span>{detailsError} <Button type="button" size="sm" variant="ghost" onClick={() => { setLoading(true); setDetailsError(""); setRetry((value) => value + 1); }}>Повторити</Button></span> : live ? "Актуальні дані Freelancehunt · без запису в БД" : "Дані з БД"}</div>
      {live && <p className="text-sm">{live.status ?? "Стан невідомий"}{live.bidCount !== null ? ` · Ставок: ${live.bidCount}` : ""}{live.expiresAt ? ` · До: ${dateLabel(live.expiresAt)} UTC` : ""}</p>}
      <div className="whitespace-pre-wrap break-words leading-6">{details.description ?? "Опис відсутній."}</div>
      <div><h3 className="mb-2 font-medium">Навички</h3><div className="flex flex-wrap gap-2">{details.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div>{!!project.categories?.length && <p className="mt-2 text-xs text-muted-foreground">Категорії: {project.categories.join(", ")}</p>}</div>
      <section className="rounded-lg border p-3"><h3 className="font-medium">Релевантність: {project.score}/100</h3><p className="mb-2 text-xs text-muted-foreground">За синхронізованими даними та вашим збереженим профілем. Сума обмежується 0–100.</p><ul className="space-y-1 text-sm">{project.reasons.map((reason, i) => <li key={i} className="flex justify-between gap-3"><span className="break-words">{reason.rule}</span><span className="shrink-0 tabular-nums">{reason.weight > 0 ? "+" : ""}{reason.weight}</span></li>)}</ul></section>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void mutate({ notes }); }}><label className="text-sm font-medium" htmlFor={`notes-${project.id}`}>Особиста нотатка</label><textarea id={`notes-${project.id}`} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-ring" maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Зберегти нотатку</Button>{noteMessage && <p role="status" className="text-sm text-muted-foreground">{noteMessage}</p>}</form>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <DialogFooter className="flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Не зберігати" : "Зберегти проєкт"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Відновити" : "Приховати"}</Button><Button render={<a href={details.url} target="_blank" rel="noreferrer" />}>На Freelancehunt</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
