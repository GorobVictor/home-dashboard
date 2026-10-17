"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import type { ScoreReason, ProjectStatePatch } from "@home-dashboard/integrations/freelancehunt-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSavedView } from "@/components/use-saved-view";

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
type ProjectView = "cards" | "list";

export function FreelancehuntProjects({ projects }: { projects: FreelancehuntProjectView[] }) {
  const [active, setActive] = useState<FreelancehuntProjectView | null>(null);
  const [view, changeView] = useSavedView("home-dashboard:freelancehunt-project-view");
  const visible = active && !projects.some((p) => p.id === active.id) ? [...projects, active] : projects;
  if (!visible.length) return <Card className="border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">No projects match the selected filters. Change the filters or enable Freelancehunt monitoring in Settings.</CardContent></Card>;
  return <section className="space-y-3"><div className="flex justify-end"><div className="inline-flex rounded-md border p-1" role="group" aria-label="Project view"><Button type="button" size="icon" variant={view === "cards" ? "secondary" : "ghost"} aria-label="Cards" aria-pressed={view === "cards"} onClick={() => changeView("cards")}><LayoutGrid className="size-4" /></Button><Button type="button" size="icon" variant={view === "list" ? "secondary" : "ghost"} aria-label="List" aria-pressed={view === "list"} onClick={() => changeView("list")}><List className="size-4" /></Button></div></div>{view === "list" && <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(120px,0.45fr)_minmax(150px,0.6fr)_minmax(180px,0.8fr)] gap-4 px-5 text-xs font-medium text-muted-foreground lg:grid"><span>Project</span><span>Score</span><span>Budget</span><span>Published</span></div>}<div className={view === "cards" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>{visible.map((project) => <ProjectCard key={project.id} project={project} view={view} onActive={(open) => setActive(open ? project : null)} />)}</div></section>;
}
const budgetLabel = (project: { budgetAmount: number | null; budgetCurrency: string | null }) => project.budgetAmount === null ? "Budget not specified" : `${project.budgetAmount.toLocaleString("en-US")} ${project.budgetCurrency ?? ""}`;
const dateLabel = (date: string) => new Date(date).toLocaleString("en-US", { timeZone: "UTC" });

function ProjectCard({ project, view, onActive }: { project: FreelancehuntProjectView; view: ProjectView; onActive: (open: boolean) => void }) {
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
  return <Dialog open={open} onOpenChange={changeOpen}>
    <Card className={`${view === "cards" ? "flex h-full flex-col" : ""} ${!state.viewed ? "border-primary/40" : ""}`}>
      <DialogTrigger disabled={busy} render={<button type="button" aria-label={`Project details: ${project.name}`} className={`${view === "cards" ? "flex-1" : "block w-full"} text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`} />}>
        {view === "cards" ? <>
          <CardHeader className="pb-2"><div className="mb-2 flex flex-wrap gap-2"><Badge variant={project.score >= 80 ? "default" : "secondary"}>{project.score}/100</Badge>{!state.viewed && <Badge variant="outline">New</Badge>}{state.saved && <Badge variant="outline">Saved</Badge>}{state.hidden && <Badge variant="outline">Hidden</Badge>}</div><CardTitle className="line-clamp-2 text-base">{project.name}</CardTitle><CardDescription>{budgetLabel(project)}</CardDescription></CardHeader>
          <CardContent><p className="line-clamp-3 text-sm text-muted-foreground">{project.description ?? "No description."}</p><p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{project.skills.join(", ") || "Skills not specified"}</p><p className="mt-2 text-xs text-muted-foreground">{project.publishedAt ? "Published: " + dateLabel(project.publishedAt) + " UTC" : "Publication date unknown"}</p></CardContent>
        </> : <CardContent className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(120px,0.45fr)_minmax(150px,0.6fr)_minmax(180px,0.8fr)] lg:items-center lg:gap-4">
          <div className="min-w-0"><CardTitle className="truncate text-base">{project.name}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{project.skills.join(", ") || "Skills not specified"}</p></div>
          <div className="flex flex-wrap gap-1"><Badge variant={project.score >= 80 ? "default" : "secondary"}>{project.score}/100</Badge>{!state.viewed && <Badge variant="outline">New</Badge>}{state.saved && <Badge variant="outline">Saved</Badge>}</div>
          <p className="text-sm text-muted-foreground">{budgetLabel(project)}</p><p className="text-xs text-muted-foreground">{project.publishedAt ? dateLabel(project.publishedAt) : "Date unknown"}</p>
        </CardContent>}
      </DialogTrigger>
      <div className={`flex flex-wrap gap-1 border-t px-4 ${view === "cards" ? "pb-4 pt-1" : "py-2"}`}><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Unsave" : "Save"}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Restore" : "Hide"}</Button>{!state.viewed && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutate({ viewed: true })}>Mark as viewed</Button>}</div>
      {actionError && !open && <p role="alert" className="px-4 pb-3 text-sm text-destructive">{actionError}</p>}
    </Card>
    <DialogContent className="dark dashboard-dialog max-h-[calc(100vh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
      <DialogHeader><DialogTitle className="pr-7 leading-snug">{details.name}</DialogTitle><DialogDescription>{budgetLabel(details)} · Found {dateLabel(project.discoveredAt)} UTC</DialogDescription></DialogHeader>
      <div aria-live="polite" className="text-sm text-muted-foreground">{loading ? "Refreshing Freelancehunt details…" : detailsError ? <span>{detailsError} <Button type="button" size="sm" variant="ghost" onClick={() => { setLoading(true); setDetailsError(""); setRetry((value) => value + 1); }}>Retry</Button></span> : live ? "Current Freelancehunt data · not stored in the database" : "Database data"}</div>
      {live && <p className="text-sm">{live.status ?? "Status unknown"}{live.bidCount !== null ? ` · Bids: ${live.bidCount}` : ""}{live.expiresAt ? ` · Until: ${dateLabel(live.expiresAt)} UTC` : ""}</p>}
      <div className="whitespace-pre-wrap break-words leading-6">{details.description ?? "No description."}</div>
      <div><h3 className="mb-2 font-medium">Skills</h3><div className="flex flex-wrap gap-2">{details.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div>{!!project.categories?.length && <p className="mt-2 text-xs text-muted-foreground">Categories: {project.categories.join(", ")}</p>}</div>
      <section className="rounded-lg border p-3"><h3 className="font-medium">Relevance: {project.score}/100</h3><p className="mb-2 text-xs text-muted-foreground">Based on synchronized data and your saved profile. The total is capped at 0–100.</p><ul className="space-y-1 text-sm">{project.reasons.map((reason, i) => <li key={i} className="flex justify-between gap-3"><span className="break-words">{reason.rule}</span><span className="shrink-0 tabular-nums">{reason.weight > 0 ? "+" : ""}{reason.weight}</span></li>)}</ul></section>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void mutate({ notes }); }}><label className="text-sm font-medium" htmlFor={`notes-${project.id}`}>Personal note</label><textarea id={`notes-${project.id}`} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-ring" maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /><Button type="submit" variant="outline" disabled={busy}>Save note</Button>{noteMessage && <p role="status" className="text-sm text-muted-foreground">{noteMessage}</p>}</form>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <DialogFooter className="flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ saved: !state.saved })}>{state.saved ? "Unsave" : "Save project"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate({ hidden: !state.hidden })}>{state.hidden ? "Restore" : "Hide"}</Button><Button render={<a href={details.url} target="_blank" rel="noreferrer" />}>Open in Freelancehunt</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
