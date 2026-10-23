"use client";

import { HelpText } from "@/components/help-text";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { Bookmark, Check, EyeOff, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import { projectWorkflows, type ProjectWorkflow, type ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState } from "@/components/loading-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSavedView } from "@/components/use-saved-view";
import { viewPreferences, type SavedView } from "@/lib/view-preferences";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FreelancehuntProjectView {
  id: number; name: string; description: string | null; url: string;
  budgetAmount: number | null; budgetCurrency: string | null; skills: string[];
  categories?: string[]; discoveredAt: string; publishedAt: string | null;
  saved: boolean; hidden: boolean; viewed: boolean; notes: string; workflow: string;
}
interface LiveProject {
  name: string; description: string | null; url: string; budgetAmount: number | null;
  budgetCurrency: string | null; skills: string[]; status: string | null; bidCount: number | null; expiresAt: string | null;
}
type ProjectView = "cards" | "list";

export function FreelancehuntProjects({ projects, initialView, initialProjectId }: { projects: FreelancehuntProjectView[]; initialView: SavedView; initialProjectId?: number }) {
  const [active, setActive] = useState<FreelancehuntProjectView | null>(() => projects.find(project => project.id === initialProjectId) ?? null);
  const [view] = useSavedView(viewPreferences.projects, initialView);
  const visible = active && !projects.some((p) => p.id === active.id) ? [...projects, active] : projects;
  if (!visible.length) return <Card className="border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">Немає проєктів за цими фільтрами. Змініть фільтри або увімкніть моніторинг у налаштуваннях.</CardContent></Card>;
  return <section aria-label={view === "list" ? "Список проєктів" : "Картки проєктів"} className="space-y-3"><div className={view === "cards" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "divide-y overflow-hidden rounded-xl border bg-card/50"}>{visible.map((project) => <ProjectCard key={project.id} project={project} view={view} autoOpen={project.id === initialProjectId} onActive={(open) => setActive(open ? project : null)} />)}</div></section>;
}
export function ProjectViewToggle({ initialView }: { initialView: SavedView }) {
  const [view, changeView] = useSavedView(viewPreferences.projects, initialView);
  return <div className="inline-flex rounded-lg bg-muted/30 p-0.5" role="group" aria-label="Вигляд проєктів"><Button type="button" size="icon" variant={view === "cards" ? "secondary" : "ghost"} aria-label="Картки" aria-pressed={view === "cards"} onClick={() => changeView("cards")}><LayoutGrid className="size-4" /></Button><Button type="button" size="icon" variant={view === "list" ? "secondary" : "ghost"} aria-label="Список" aria-pressed={view === "list"} onClick={() => changeView("list")}><List className="size-4" /></Button></div>;
}

const budgetLabel = (project: { budgetAmount: number | null; budgetCurrency: string | null }) => project.budgetAmount === null ? "Бюджет не вказаний" : `${project.budgetAmount.toLocaleString("uk-UA")} ${project.budgetCurrency ?? ""}`;
const shortDateFormat = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const compactDate = (date: string) => shortDateFormat.format(new Date(date));
const dateLabel = (date: string) => formatDate(date);

async function updateProject(id: number, patch: ProjectStatePatch, signal?: AbortSignal) {
  const response = await fetch(`/api/freelancehunt/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch), signal });
  if (!response.ok) throw new Error("Не вдалося зберегти зміни. Повторіть спробу.");
}

function ProjectCard({ project, view, onActive, autoOpen = false }: { project: FreelancehuntProjectView; view: ProjectView; autoOpen?: boolean; onActive: (open: boolean) => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(autoOpen), [live, setLive] = useState<LiveProject | null>(null);
  const [loading, setLoading] = useState(autoOpen), [detailsError, setDetailsError] = useState("");
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const [notes, setNotes] = useState(project.notes), [noteMessage, setNoteMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [localState, setLocalState] = useState<Partial<Pick<FreelancehuntProjectView, "saved" | "hidden" | "viewed" | "workflow">>>({});
  const state = { ...project, ...localState };
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/freelancehunt/projects/${project.id}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 429 ? "Досягнуто ліміту API Freelancehunt. Спробуйте пізніше." : response.status === 404 ? "Цей проєкт більше недоступний на Freelancehunt." : "Не вдалося оновити деталі. Показано збережені дані.");
      const result: LiveProject = await response.json();
      if (!controller.signal.aborted) setLive(result);
    }).catch((error) => { if (!controller.signal.aborted) setDetailsError(error instanceof Error ? error.message : "Не вдалося оновити деталі."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, project.id, retry]);
  async function mutate(patch: ProjectStatePatch) {
    setBusy(true); setActionError(""); setNoteMessage("");
    try {
      await updateProject(project.id, patch);
      setLocalState((previous) => ({ ...previous, ...(patch.saved === undefined ? {} : { saved: patch.saved }), ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }), ...(patch.viewed ? { viewed: true } : {}), ...(patch.workflow ? { workflow: patch.workflow } : {}) }));
      if (patch.notes !== undefined) setNoteMessage("Нотатку збережено.");
      router.refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Запит не вдався."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!autoOpen || project.viewed) return;
    const controller = new AbortController();
    void updateProject(project.id, { viewed: true }, controller.signal).then(() => {
      if (!controller.signal.aborted) { setLocalState(previous => ({ ...previous, viewed: true })); router.refresh(); }
    }).catch(() => { if (!controller.signal.aborted) setActionError("Не вдалося позначити проєкт переглянутим."); });
    return () => controller.abort();
  }, [autoOpen, project.id, project.viewed, router]);
  function changeOpen(next: boolean) {
    setOpen(next);
    onActive(next);
    if (next) { setLive(null); setLoading(true); setDetailsError(""); if (!state.viewed) void mutate({ viewed: true }); }
  }
  const details = live ?? project;
  const Root = view === "cards" ? Card : "article";
  const actions = <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Дії для ${project.name}`} disabled={busy} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}><Bookmark className="size-4" />{state.saved ? "Не зберігати" : "Зберегти проєкт"}</DropdownMenuItem>
    <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}><EyeOff className="size-4" />{state.hidden ? "Відновити" : "Приховати проєкт"}</DropdownMenuItem>
    {!state.viewed && <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ viewed: true })}><Check className="size-4" />Позначити переглянутим</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
  return <Dialog open={open} onOpenChange={changeOpen}>
    <Root className={view === "cards" ? `flex h-full flex-col gap-2 py-3 [--card-spacing:--spacing(3)] sm:gap-4 sm:[--card-spacing:--spacing(4)] ${!state.viewed ? "border-primary/40" : ""}` : "relative flex min-w-0 items-start gap-1 p-2 pr-1 hover:bg-muted/20"}>
      <DialogTrigger disabled={busy} render={<button type="button" aria-label={`Деталі проєкту: ${project.name}`} className={`${view === "cards" ? "flex-1" : "min-w-0 flex-1 rounded-md px-1 py-1"} text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`} />}>
        {view === "cards" ? <>
          <CardHeader className="pb-2"><div className="mb-1 flex flex-wrap gap-1.5 sm:mb-2 sm:gap-2">{!state.viewed && <Badge variant="outline">Новий</Badge>}{state.saved && <Badge variant="outline">Збережений</Badge>}{state.hidden && <Badge variant="outline">Прихований</Badge>}</div><CardTitle className="line-clamp-2 break-words text-sm sm:text-base">{project.name}</CardTitle><CardDescription className="text-xs font-medium text-foreground sm:text-sm">{budgetLabel(project)}</CardDescription></CardHeader>
          <CardContent><p className="line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-3 sm:text-sm">{project.description ?? "Опису немає."}</p><p className="mt-2 line-clamp-1 text-xs text-muted-foreground sm:mt-3">{project.skills.join(", ") || "Навички не вказані"}</p><p className="mt-1 text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{project.publishedAt ? dateLabel(project.publishedAt) + " · Київ" : "Дата публікації невідома"}</p></CardContent>
        </> : <>
          <span className="flex min-w-0 items-start gap-1.5"><span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${state.viewed ? "bg-transparent" : "bg-emerald-400"}`} /><span className="line-clamp-2 min-w-0 text-[13px] leading-5 font-medium">{project.name}</span>{state.saved && <Bookmark aria-label="Збережений" className="mt-0.5 size-3.5 shrink-0 fill-current text-emerald-300" />}</span>
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-3 text-[11px] tabular-nums"><span className="min-w-0 truncate font-medium">{project.budgetAmount == null ? "Бюджет —" : budgetLabel(project)}</span><time dateTime={project.publishedAt ?? undefined} title={project.publishedAt ? `${dateLabel(project.publishedAt)} · Київ` : undefined} className="text-muted-foreground">{project.publishedAt ? compactDate(project.publishedAt) : "Дата —"}</time>{!state.viewed && <span className="sr-only">Новий проєкт</span>}</span>
        </>}
      </DialogTrigger>
      {view === "cards" ? <div className="-mb-3 flex items-center justify-between gap-2 border-t pr-1 pl-2"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}><Bookmark className={`size-3.5 ${state.saved ? "fill-current" : ""}`} />{state.saved ? "Збережений" : "Зберегти"}</Button>{actions}</div> : actions}
      {actionError && !open && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{actionError}</p>}
    </Root>
    <DialogContent initialFocus={titleRef} className="dark dashboard-dialog h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] content-start overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere] sm:h-[min(48rem,calc(100dvh-2rem))] sm:max-w-2xl sm:p-6">
      <DialogHeader><DialogTitle ref={titleRef} tabIndex={-1} className="pr-12 leading-snug outline-none">{details.name}</DialogTitle><DialogDescription>{budgetLabel(details)} · Знайдено {dateLabel(project.discoveredAt)} · Київ</DialogDescription></DialogHeader>
      <div aria-live="polite" className="text-sm text-muted-foreground">{loading ? <LoadingState label="Оновлюємо деталі Freelancehunt" className="space-y-3"><Skeleton className="h-4 w-3/4 max-w-80" /><div className="flex gap-2"><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-5 w-24 rounded-full" /></div></LoadingState> : detailsError ? <span>{detailsError} <Button type="button" size="sm" variant="ghost" onClick={() => { setLoading(true); setDetailsError(""); setRetry((value) => value + 1); }}>Повторити</Button></span> : live ? "Актуальні дані Freelancehunt" : "Збережені дані"}</div>
      {live && <p className="text-sm">{live.status ?? "Статус невідомий"}{live.bidCount !== null ? ` · Заявок: ${live.bidCount}` : ""}{live.expiresAt ? ` · До: ${dateLabel(live.expiresAt)} · Київ` : ""}</p>}
      <div className="whitespace-pre-wrap break-words leading-6">{details.description ?? "Опису немає."}</div>
      <div><h3 className="mb-2 font-medium">Навички</h3><div className="flex flex-wrap gap-2">{details.skills.map((skill) => <Badge key={skill} variant="secondary" className="h-auto min-h-5 max-w-full rounded-lg whitespace-normal break-words text-left">{skill}</Badge>)}</div>{!!project.categories?.length && <p className="mt-2 text-xs text-muted-foreground">Категорії: {project.categories.join(", ")}</p>}</div>
      <label className="grid gap-2 text-sm"><HelpText>Робочий статус</HelpText><select aria-label="Робочий статус" disabled={busy} className="min-h-11 rounded border bg-background p-2" value={state.workflow} onChange={event => void mutate({ workflow: event.target.value as ProjectWorkflow })}>{Object.entries(projectWorkflows).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void mutate({ notes }); }}><label className="text-sm font-medium" htmlFor={`notes-${project.id}`}><HelpText>Особиста нотатка</HelpText></label><textarea aria-label="Особиста нотатка" id={`notes-${project.id}`} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-ring" maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Зберегти нотатку</Button>{noteMessage && <p role="status" className="text-sm text-muted-foreground">{noteMessage}</p>}</form>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <DialogFooter className="grid grid-cols-2 sm:-mx-6 sm:-mb-6 sm:flex sm:flex-wrap sm:p-6"><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Не зберігати" : "Зберегти проєкт"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Відновити" : "Приховати"}</Button><a className={buttonVariants({ className: "col-span-2 min-h-11 sm:min-h-8" })} href={details.url} target="_blank" rel="noreferrer">Відкрити на Freelancehunt</a></DialogFooter>
    </DialogContent>
  </Dialog>;
}
