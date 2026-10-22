"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, EyeOff, LayoutGrid, List, MoreHorizontal } from "lucide-react";
import type { ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSavedView } from "@/components/use-saved-view";
import { viewPreferences, type SavedView } from "@/lib/view-preferences";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FreelancehuntProjectView {
  id: number; name: string; description: string | null; url: string;
  budgetAmount: number | null; budgetCurrency: string | null; skills: string[];
  categories?: string[]; discoveredAt: string; publishedAt: string | null;
  saved: boolean; hidden: boolean; viewed: boolean; notes: string;
}
interface LiveProject {
  name: string; description: string | null; url: string; budgetAmount: number | null;
  budgetCurrency: string | null; skills: string[]; status: string | null; bidCount: number | null; expiresAt: string | null;
}
type ProjectView = "cards" | "list";

export function FreelancehuntProjects({ projects, initialView }: { projects: FreelancehuntProjectView[]; initialView: SavedView }) {
  const [active, setActive] = useState<FreelancehuntProjectView | null>(null);
  const [view] = useSavedView(viewPreferences.projects, initialView);
  const visible = active && !projects.some((p) => p.id === active.id) ? [...projects, active] : projects;
  if (!visible.length) return <Card className="border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">No projects match the selected filters. Change the filters or enable Freelancehunt monitoring in Settings.</CardContent></Card>;
  return <section aria-label={view === "list" ? "Project list" : "Project cards"} className="space-y-3"><div className={view === "cards" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "divide-y overflow-hidden rounded-xl border bg-card/50"}>{visible.map((project) => <ProjectCard key={project.id} project={project} view={view} onActive={(open) => setActive(open ? project : null)} />)}</div></section>;
}
export function ProjectViewToggle({ initialView }: { initialView: SavedView }) {
  const [view, changeView] = useSavedView(viewPreferences.projects, initialView);
  return <div className="inline-flex rounded-lg bg-muted/30 p-0.5" role="group" aria-label="Project view"><Button type="button" size="icon" variant={view === "cards" ? "secondary" : "ghost"} aria-label="Cards" aria-pressed={view === "cards"} onClick={() => changeView("cards")}><LayoutGrid className="size-4" /></Button><Button type="button" size="icon" variant={view === "list" ? "secondary" : "ghost"} aria-label="List" aria-pressed={view === "list"} onClick={() => changeView("list")}><List className="size-4" /></Button></div>;
}

const budgetLabel = (project: { budgetAmount: number | null; budgetCurrency: string | null }) => project.budgetAmount === null ? "Budget not specified" : `${project.budgetAmount.toLocaleString("en-US")} ${project.budgetCurrency ?? ""}`;
const shortDateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const compactDate = (date: string) => shortDateFormat.format(new Date(date));
const dateLabel = (date: string) => new Date(date).toLocaleString("en-US", { timeZone: "UTC" });

function ProjectCard({ project, view, onActive }: { project: FreelancehuntProjectView; view: ProjectView; onActive: (open: boolean) => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
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
      if (!response.ok) throw new Error(response.status === 429 ? "Freelancehunt API limit reached. Try again later." : response.status === 404 ? "This project is no longer available on Freelancehunt." : "Could not refresh project details. Database data is shown.");
      const result: LiveProject = await response.json();
      if (!controller.signal.aborted) setLive(result);
    }).catch((error) => { if (!controller.signal.aborted) setDetailsError(error instanceof Error ? error.message : "Could not refresh project details."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, project.id, retry]);
  async function mutate(patch: ProjectStatePatch) {
    setBusy(true); setActionError(""); setNoteMessage("");
    try {
      const response = await fetch(`/api/freelancehunt/projects/${project.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error("Could not save changes. Try again.");
      setLocalState((previous) => ({ ...previous, ...(patch.saved === undefined ? {} : { saved: patch.saved }), ...(patch.hidden === undefined ? {} : { hidden: patch.hidden }), ...(patch.viewed ? { viewed: true } : {}) }));
      if (patch.notes !== undefined) setNoteMessage("Note saved.");
      router.refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  function changeOpen(next: boolean) {
    setOpen(next);
    onActive(next);
    if (next) { setLive(null); setLoading(true); setDetailsError(""); if (!state.viewed) void mutate({ viewed: true }); }
  }
  const details = live ?? project;
  const Root = view === "cards" ? Card : "article";
  const actions = <DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${project.name}`} disabled={busy} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}><Bookmark className="size-4" />{state.saved ? "Unsave" : "Save project"}</DropdownMenuItem>
    <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}><EyeOff className="size-4" />{state.hidden ? "Restore" : "Hide project"}</DropdownMenuItem>
    {!state.viewed && <DropdownMenuItem className="min-h-11 px-3" disabled={busy} onClick={() => void mutate({ viewed: true })}><Check className="size-4" />Mark as viewed</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu>;
  return <Dialog open={open} onOpenChange={changeOpen}>
    <Root className={view === "cards" ? `flex h-full flex-col gap-2 py-3 [--card-spacing:--spacing(3)] sm:gap-4 sm:[--card-spacing:--spacing(4)] ${!state.viewed ? "border-primary/40" : ""}` : "relative flex min-w-0 items-start gap-1 p-2 pr-1 hover:bg-muted/20"}>
      <DialogTrigger disabled={busy} render={<button type="button" aria-label={`Project details: ${project.name}`} className={`${view === "cards" ? "flex-1" : "min-w-0 flex-1 rounded-md px-1 py-1"} text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`} />}>
        {view === "cards" ? <>
          <CardHeader className="pb-2"><div className="mb-1 flex flex-wrap gap-1.5 sm:mb-2 sm:gap-2">{!state.viewed && <Badge variant="outline">New</Badge>}{state.saved && <Badge variant="outline">Saved</Badge>}{state.hidden && <Badge variant="outline">Hidden</Badge>}</div><CardTitle className="line-clamp-2 break-words text-sm sm:text-base">{project.name}</CardTitle><CardDescription className="text-xs font-medium text-foreground sm:text-sm">{budgetLabel(project)}</CardDescription></CardHeader>
          <CardContent><p className="line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-3 sm:text-sm">{project.description ?? "No description."}</p><p className="mt-2 line-clamp-1 text-xs text-muted-foreground sm:mt-3">{project.skills.join(", ") || "Skills not specified"}</p><p className="mt-1 text-[11px] text-muted-foreground sm:mt-2 sm:text-xs">{project.publishedAt ? dateLabel(project.publishedAt) + " UTC" : "Publication date unknown"}</p></CardContent>
        </> : <>
          <span className="flex min-w-0 items-start gap-1.5"><span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${state.viewed ? "bg-transparent" : "bg-emerald-400"}`} /><span className="line-clamp-2 min-w-0 text-[13px] leading-5 font-medium">{project.name}</span>{state.saved && <Bookmark aria-label="Saved" className="mt-0.5 size-3.5 shrink-0 fill-current text-emerald-300" />}</span>
          <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-3 text-[11px] tabular-nums"><span className="min-w-0 truncate font-medium">{project.budgetAmount == null ? "Budget —" : budgetLabel(project)}</span><time dateTime={project.publishedAt ?? undefined} title={project.publishedAt ? `${dateLabel(project.publishedAt)} UTC` : undefined} className="text-muted-foreground">{project.publishedAt ? compactDate(project.publishedAt) : "Date —"}</time>{!state.viewed && <span className="sr-only">New project</span>}</span>
        </>}
      </DialogTrigger>
      {view === "cards" ? <div className="-mb-3 flex items-center justify-between gap-2 border-t pr-1 pl-2"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}><Bookmark className={`size-3.5 ${state.saved ? "fill-current" : ""}`} />{state.saved ? "Saved" : "Save"}</Button>{actions}</div> : actions}
      {actionError && !open && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{actionError}</p>}
    </Root>
    <DialogContent initialFocus={titleRef} className="dark dashboard-dialog h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] content-start overflow-y-auto overscroll-contain p-4 [overflow-wrap:anywhere] sm:h-[min(48rem,calc(100dvh-2rem))] sm:max-w-2xl sm:p-6">
      <DialogHeader><DialogTitle ref={titleRef} tabIndex={-1} className="pr-7 leading-snug outline-none">{details.name}</DialogTitle><DialogDescription>{budgetLabel(details)} · Found {dateLabel(project.discoveredAt)} UTC</DialogDescription></DialogHeader>
      <div aria-live="polite" className="text-sm text-muted-foreground">{loading ? "Refreshing Freelancehunt details…" : detailsError ? <span>{detailsError} <Button type="button" size="sm" variant="ghost" onClick={() => { setLoading(true); setDetailsError(""); setRetry((value) => value + 1); }}>Retry</Button></span> : live ? "Current Freelancehunt data · not stored in the database" : "Database data"}</div>
      {live && <p className="text-sm">{live.status ?? "Status unknown"}{live.bidCount !== null ? ` · Bids: ${live.bidCount}` : ""}{live.expiresAt ? ` · Until: ${dateLabel(live.expiresAt)} UTC` : ""}</p>}
      <div className="whitespace-pre-wrap break-words leading-6">{details.description ?? "No description."}</div>
      <div><h3 className="mb-2 font-medium">Skills</h3><div className="flex flex-wrap gap-2">{details.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div>{!!project.categories?.length && <p className="mt-2 text-xs text-muted-foreground">Categories: {project.categories.join(", ")}</p>}</div>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void mutate({ notes }); }}><label className="text-sm font-medium" htmlFor={`notes-${project.id}`}>Personal note</label><textarea id={`notes-${project.id}`} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-ring" maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Save note</Button>{noteMessage && <p role="status" className="text-sm text-muted-foreground">{noteMessage}</p>}</form>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <DialogFooter className="grid grid-cols-2 sm:flex sm:flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Unsave" : "Save project"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Restore" : "Hide"}</Button><Button className="col-span-2" render={<a href={details.url} target="_blank" rel="noreferrer" />}>Open in Freelancehunt</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
