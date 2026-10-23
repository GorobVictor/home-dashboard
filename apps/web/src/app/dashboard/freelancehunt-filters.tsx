"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { getFreelancehuntWorkspace } from "@home-dashboard/database";
import type { FreelancehuntSkill } from "@home-dashboard/integrations";
import { emptyProjectFilters, parseProjectFilters, projectWorkflows, type ProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
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
  return parseProjectFilters({ minBudget: amount("minBudget"), maxBudget: amount("maxBudget"), currency: data.get("currency"), skillIds: data.getAll("skillIds").map(Number), categories: data.getAll("categories").map(String), include: split(data.get("include")), exclude: split(data.get("exclude")), from: data.get("from"), to: data.get("to"), state: data.get("state"), workflow: data.get("workflow"), sort: data.get("sort") });
}
export function FreelancehuntFilters({ workspace, initialView }: { workspace: Workspace; initialView: SavedView }) {
  const router = useRouter(), filters = workspace.filters;
  const [presetId, setPresetId] = useState("");
  const [filterReset, setFilterReset] = useState(0);
  const [skills, setSkills] = useState<FreelancehuntSkill[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadFreelancehuntCatalogue().then((skills) => { if (active) setSkills(skills); }).catch(() => { if (active) setCatalogueError("Каталог навичок недоступний. Збережений вибір залишається активним."); }).finally(() => { if (active) setCatalogueLoading(false); });
    return () => { active = false; };
  }, []);
  async function request(path: string, method: string, body?: object) {
    const response = await fetch(`/api/freelancehunt/${path}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("Не вдалося зберегти. Перевірте значення й повторіть спробу.");
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await run(); router.refresh(); } catch (error) { setMessage(error instanceof Error && error.message !== "invalid_input" ? error.message : "Перевірте фільтри."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await action(async () => {
      const filters = formFilters(form);
      const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (intent === "preset") {
        const name = String(data.get("presetName") ?? "").trim();
        if (!name) throw new Error("Введіть назву набору.");
        await request("presets", "POST", { name, filters });
        setMessage("Набір збережено. Наявний набір із такою назвою оновлено.");
      } else {
        await request("workspace", "PUT", { filters });
        router.push("/dashboard?tab=freelancehunt");
        setMessage("Фільтри збережено.");
      }
    });
  }
  const categories = [...new Set([...skills.map((s) => s.groupName), ...filters.categories])].sort((a, b) => a.localeCompare(b, "uk"));
  return <div className="relative min-w-0"><details className="rounded-xl border bg-card p-3 sm:p-4"><summary className="-m-3 flex min-h-13 cursor-pointer list-none items-center gap-2 p-3 pr-28 text-xs font-medium sm:-m-4 sm:p-4 sm:pr-28 sm:text-sm [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground" />Фільтри</summary>
    <div className="mt-4 flex flex-wrap items-end gap-2"><FreelancehuntSelect label="Набір фільтрів" className="w-full sm:w-72" value={presetId} onValueChange={setPresetId} disabled={busy || !workspace.presets.length} options={[{ value: "", label: workspace.presets.length ? "Оберіть набір" : "Наборів поки немає" }, ...workspace.presets.map((preset) => ({ value: preset.id, label: preset.name }))]} /><Button className="h-10" type="button" variant="outline" disabled={busy || !presetId} onClick={() => void action(async () => { const preset = workspace.presets.find((p) => p.id === presetId)!; await request("workspace", "PUT", { filters: preset.filters }); router.push("/dashboard?tab=freelancehunt"); })}>Застосувати</Button><Button className="h-10" type="button" variant="ghost" disabled={busy || !presetId} onClick={() => void action(async () => { await request(`presets/${presetId}`, "DELETE"); setPresetId(""); })}>Видалити</Button></div>
    <form key={filterReset} className="mt-4 space-y-5" onSubmit={(event) => void submit(event)}><fieldset disabled={busy} className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Мінімальний бюджет</span><Input className="block h-10" name="minBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.minBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Максимальний бюджет</span><Input className="block h-10" name="maxBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.maxBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Валюта (ISO)</span><Input className="block h-10" name="currency" maxLength={3} pattern="[A-Z]{3}|" placeholder="Будь-яка / UAH / USD" defaultValue={filters.currency} /></label>
      <FreelancehuntSelect name="state" label="Стан" defaultValue={filters.state} disabled={busy} options={[{ value: "all", label: "Усі видимі" }, { value: "new", label: "Нові (не переглянуті)" }, { value: "viewed", label: "Переглянуті" }, { value: "saved", label: "Збережений" }, { value: "hidden", label: "Прихований" }]} />
      <label className="flex min-w-0 flex-col gap-2 text-sm col-span-2"><span className="font-medium">Містить усі слова / фрази (через кому)</span><Input className="block h-10" name="include" maxLength={3000} defaultValue={filters.include.join(", ")} /></label><label className="flex min-w-0 flex-col gap-2 text-sm col-span-2"><span className="font-medium">Без слів / фраз (через кому)</span><Input className="block h-10" name="exclude" maxLength={3000} defaultValue={filters.exclude.join(", ")} /></label>
      <label className="col-span-2 flex min-w-0 flex-col gap-2 text-sm min-[360px]:col-span-1"><span className="font-medium">Опубліковано з (UTC)</span><Input className="mt-auto block h-10" type="date" name="from" defaultValue={filters.from} /></label><label className="col-span-2 flex min-w-0 flex-col gap-2 text-sm min-[360px]:col-span-1"><span className="font-medium">Опубліковано до (UTC)</span><Input className="mt-auto block h-10" type="date" name="to" defaultValue={filters.to} /></label>
      <FreelancehuntMultiselect name="skillIds" label="Навички" placeholder="Будь-які навички" options={skills.map((skill) => ({ value: String(skill.id), label: skill.name, group: skill.groupName }))} defaultValue={filters.skillIds.map(String)} limit={50} disabled={busy} loading={catalogueLoading} />
      <FreelancehuntMultiselect name="categories" label="Категорії" placeholder="Будь-які категорії" options={categories.map((name) => ({ value: name, label: name }))} defaultValue={filters.categories} limit={30} disabled={busy} loading={catalogueLoading} />
      <FreelancehuntSelect name="workflow" label="Робочий статус" defaultValue={filters.workflow} options={[{ value: "all", label: "Усі статуси" }, ...Object.entries(projectWorkflows).map(([value, label]) => ({ value, label }))]} />
      <FreelancehuntSelect name="sort" label="Сортування" className="col-span-2" defaultValue={filters.sort} disabled={busy} options={[{ value: "date", label: "Дата публікації ↓" }, { value: "budget", label: "Валюта ↑, бюджет ↓" }]} />
    </fieldset>
    <p className="text-xs text-muted-foreground">Фільтри застосовуються до зібраних проєктів і нових особистих сповіщень. Навички збору задаються в налаштуваннях. Валюти не конвертуються. Нові — ще не переглянуті вами. Telegram використовує правила спільного каналу.</p>
    {catalogueError && <p role="status" className="text-sm text-muted-foreground">{catalogueError}</p>}{!workspace.catalogueReady && <p className="text-xs text-muted-foreground">Категорії старих проєктів з’являться після завантаження каталогу фоновим процесом.</p>}
    <div className="flex flex-wrap items-center gap-2"><Button className="h-10" type="submit" disabled={busy}>{busy ? "Зберігаємо…" : "Застосувати й зберегти"}</Button><Button className="h-10" type="button" variant="outline" disabled={busy} onClick={() => void action(async () => { await request("workspace", "PUT", { filters: emptyProjectFilters }); setFilterReset((value) => value + 1); router.push("/dashboard?tab=freelancehunt"); })}>Скинути фільтри</Button><Input aria-label="Назва нового набору" name="presetName" className="h-10 w-full sm:w-52" maxLength={100} placeholder="Назва набору" /><Button className="h-10" type="submit" name="intent" value="preset" variant="outline" disabled={busy}>Зберегти набір</Button></div>
    </form>{message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details><div className="absolute top-1 right-1"><ProjectViewToggle initialView={initialView} /></div></div>;
}
