"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { getFreelancehuntWorkspace } from "@home-dashboard/database";
import type { FreelancehuntSkill } from "@home-dashboard/integrations";
import { emptyProjectFilters, parseProjectFilters, parseScoringProfile, type ProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
import { FreelancehuntScoringEditor } from "@/components/freelancehunt-scoring-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadFreelancehuntCatalogue } from "./freelancehunt-catalogue";
import { FreelancehuntMultiselect } from "./freelancehunt-multiselect";
import { FreelancehuntSelect } from "./freelancehunt-select";
import { ProjectViewToggle } from "./freelancehunt-projects";
import type { SavedView } from "@/lib/view-preferences";

type Workspace = Awaited<ReturnType<typeof getFreelancehuntWorkspace>>;
const split = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function formFilters(form: HTMLFormElement): ProjectFilters {
  const data = new FormData(form);
  const amount = (key: string) => data.get(key) === "" ? null : Number(data.get(key));
  return parseProjectFilters({ minBudget: amount("minBudget"), maxBudget: amount("maxBudget"), currency: data.get("currency"), skillIds: data.getAll("skillIds").map(Number), categories: data.getAll("categories").map(String), include: split(data.get("include")), exclude: split(data.get("exclude")), from: data.get("from"), to: data.get("to"), minScore: Number(data.get("minScore")), maxScore: Number(data.get("maxScore")), state: data.get("state"), sort: data.get("sort") });
}
export function FreelancehuntFilters({ workspace, initialView }: { workspace: Workspace; initialView: SavedView }) {
  const router = useRouter(), filters = workspace.filters;
  const [scoring, setScoring] = useState(workspace.scoring);
  const [presetId, setPresetId] = useState("");
  const [filterReset, setFilterReset] = useState(0);
  const [skills, setSkills] = useState<FreelancehuntSkill[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadFreelancehuntCatalogue().then((skills) => { if (active) setSkills(skills); }).catch(() => { if (active) setCatalogueError("The skill catalogue is unavailable. Your saved selection remains active."); });
    return () => { active = false; };
  }, []);
  async function request(path: string, method: string, body?: object) {
    const response = await fetch(`/api/freelancehunt/${path}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("Could not save. Check the values and try again.");
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await run(); router.refresh(); } catch (error) { setMessage(error instanceof Error && error.message !== "invalid_input" ? error.message : "Check the filters and scoring rules."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await action(async () => {
      const filters = formFilters(form), profile = parseScoringProfile(scoring);
      const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (intent === "preset") {
        const name = String(data.get("presetName") ?? "").trim();
        if (!name) throw new Error("Enter a preset name.");
        await request("presets", "POST", { name, filters, scoring: profile });
        setMessage("Preset saved. An existing preset with the same name is updated.");
      } else {
        await request("workspace", "PUT", { filters, scoring: profile, notificationMinScore: Number(data.get("notificationMinScore")) });
        router.push("/dashboard?tab=freelancehunt");
        setMessage("Filters and rules saved.");
      }
    });
  }
  const categories = [...new Set([...skills.map((s) => s.groupName), ...filters.categories])].sort((a, b) => a.localeCompare(b, "uk"));
  return <div className="relative min-w-0"><details className="rounded-xl border bg-card p-3 sm:p-4"><summary className="-m-3 flex min-h-13 cursor-pointer list-none items-center gap-2 p-3 pr-28 text-xs font-medium sm:-m-4 sm:p-4 sm:pr-28 sm:text-sm [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground" />Filters & relevance</summary>
    <div className="mt-4 flex flex-wrap items-end gap-2"><FreelancehuntSelect label="Preset" className="w-full sm:w-72" value={presetId} onValueChange={setPresetId} disabled={busy || !workspace.presets.length} options={[{ value: "", label: workspace.presets.length ? "Choose a preset" : "No presets yet" }, ...workspace.presets.map((preset) => ({ value: preset.id, label: preset.name }))]} /><Button className="h-10" type="button" variant="outline" disabled={busy || !presetId} onClick={() => void action(async () => { const preset = workspace.presets.find((p) => p.id === presetId)!; await request("workspace", "PUT", { filters: preset.filters, scoring: preset.scoring }); router.push("/dashboard?tab=freelancehunt"); })}>Apply</Button><Button className="h-10" type="button" variant="ghost" disabled={busy || !presetId} onClick={() => void action(async () => { await request(`presets/${presetId}`, "DELETE"); setPresetId(""); })}>Delete</Button></div>
    <form key={filterReset} className="mt-4 space-y-5" onSubmit={(event) => void submit(event)}><fieldset disabled={busy} className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Minimum budget</span><Input className="block h-10" name="minBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.minBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Maximum budget</span><Input className="block h-10" name="maxBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.maxBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Currency (ISO)</span><Input className="block h-10" name="currency" maxLength={3} pattern="[A-Z]{3}|" placeholder="Any / UAH / USD" defaultValue={filters.currency} /></label>
      <FreelancehuntSelect name="state" label="State" defaultValue={filters.state} disabled={busy} options={[{ value: "all", label: "All visible" }, { value: "new", label: "New (not viewed)" }, { value: "viewed", label: "Viewed" }, { value: "saved", label: "Saved" }, { value: "hidden", label: "Hidden" }]} />
      <label className="flex min-w-0 flex-col gap-2 text-sm col-span-2"><span className="font-medium">Contains all words / phrases (comma separated)</span><Input className="block h-10" name="include" maxLength={3000} defaultValue={filters.include.join(", ")} /></label><label className="flex min-w-0 flex-col gap-2 text-sm col-span-2"><span className="font-medium">Excludes any word / phrase (comma separated)</span><Input className="block h-10" name="exclude" maxLength={3000} defaultValue={filters.exclude.join(", ")} /></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Published from (UTC)</span><Input className="block h-10" type="date" name="from" defaultValue={filters.from} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Published to (UTC)</span><Input className="block h-10" type="date" name="to" defaultValue={filters.to} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Minimum score</span><Input className="block h-10" name="minScore" type="number" min={0} max={100} required defaultValue={filters.minScore} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Maximum score</span><Input className="block h-10" name="maxScore" type="number" min={0} max={100} required defaultValue={filters.maxScore} /></label>
      <FreelancehuntMultiselect name="skillIds" label="Skills" placeholder="Any skills" options={skills.map((skill) => ({ value: String(skill.id), label: skill.name, group: skill.groupName }))} defaultValue={filters.skillIds.map(String)} limit={50} disabled={busy} loading={!skills.length && !catalogueError} />
      <FreelancehuntMultiselect name="categories" label="Categories" placeholder="Any categories" options={categories.map((name) => ({ value: name, label: name }))} defaultValue={filters.categories} limit={30} disabled={busy} loading={!skills.length && !catalogueError} />
      <FreelancehuntSelect name="sort" label="Sort" className="col-span-2" defaultValue={filters.sort} disabled={busy} options={[{ value: "date", label: "Publication date ↓" }, { value: "relevance", label: "Relevance ↓" }, { value: "budget", label: "Currency ↑, budget ↓" }]} />
      <label className="flex min-w-0 flex-col gap-2 text-sm col-span-2"><span className="font-medium">Notify me when the score is ≥</span><Input className="block h-10" name="notificationMinScore" type="number" min={0} max={100} required defaultValue={workspace.notificationMinScore} /></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">Filters apply to synchronized projects. Configure the skill list for collection in Settings. Budgets in different currencies are not converted. “New” means you have not viewed the project yet. The notification threshold applies only to future discoveries; Telegram has a separate profile in channel settings.</p>
    {catalogueError && <p role="status" className="text-sm text-muted-foreground">{catalogueError}</p>}{!workspace.catalogueReady && <p className="text-xs text-muted-foreground">Categories and skill IDs of older projects are populated after the worker successfully loads the catalogue.</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Edit scoring</summary><div className="mt-3"><FreelancehuntScoringEditor value={scoring} onChange={setScoring} disabled={busy} /></div></details>
    <div className="flex flex-wrap items-center gap-2"><Button className="h-10" type="submit" disabled={busy}>{busy ? "Saving…" : "Apply and save"}</Button><Button className="h-10" type="button" variant="outline" disabled={busy} onClick={() => void action(async () => { await request("workspace", "PUT", { filters: emptyProjectFilters }); setFilterReset((value) => value + 1); router.push("/dashboard?tab=freelancehunt"); })}>Reset filters</Button><Input aria-label="New preset name" name="presetName" className="h-10 w-full sm:w-52" maxLength={100} placeholder="Preset name" /><Button className="h-10" type="submit" name="intent" value="preset" variant="outline" disabled={busy}>Save preset</Button></div>
    </form>{message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details><div className="absolute top-1 right-1"><ProjectViewToggle initialView={initialView} /></div></div>;
}
