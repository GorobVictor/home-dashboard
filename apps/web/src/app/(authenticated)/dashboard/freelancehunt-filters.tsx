"use client";

import { HelpText } from "@/components/help-text";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
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
  return <div className="relative min-w-0">
    <details className="group/filters surface-panel !p-0">
      <summary className="flex min-h-18 cursor-pointer list-none items-center gap-2 px-4 py-4 pr-32 text-sm font-semibold sm:px-6 sm:pr-36 [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden="true" className="size-4 text-primary" />Фільтри проєктів<ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open/filters:rotate-180" /></summary>
      <div className="space-y-6 border-t px-4 pt-5 pb-4 sm:px-6 sm:pb-6">
        {workspace.presets.length > 0 && <div className="grid items-end gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-4">
          <FreelancehuntSelect label="Набір фільтрів" value={presetId} onValueChange={setPresetId} disabled={busy || !workspace.presets.length} options={[{ value: "", label: workspace.presets.length ? "Оберіть набір" : "Наборів поки немає" }, ...workspace.presets.map(preset => ({ value: preset.id, label: preset.name }))]} />
          <Button type="button" variant="outline" disabled={busy || !presetId} onClick={() => void action(async () => { const preset = workspace.presets.find(p => p.id === presetId)!; await request("workspace", "PUT", { filters: preset.filters }); router.push("/dashboard?tab=freelancehunt"); })}>Застосувати</Button>
          <Button type="button" variant="ghost" disabled={busy || !presetId} onClick={() => void action(async () => { await request(`presets/${presetId}`, "DELETE"); setPresetId(""); })}>Видалити</Button>
        </div>}
        <form key={filterReset} className="space-y-6" onSubmit={event => void submit(event)}>
          <fieldset disabled={busy} className="space-y-5">
            <legend className="section-eyebrow mb-4">Умови пошуку</legend>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="form-field"><HelpText>Мінімальний бюджет</HelpText><Input aria-label="Мінімальний бюджет" name="minBudget" type="number" min={0} max={1e12} step="any" placeholder="Без мінімуму" defaultValue={filters.minBudget ?? ""} /></label>
              <label className="form-field"><HelpText>Максимальний бюджет</HelpText><Input aria-label="Максимальний бюджет" name="maxBudget" type="number" min={0} max={1e12} step="any" placeholder="Без максимуму" defaultValue={filters.maxBudget ?? ""} /></label>
              <label className="form-field"><HelpText>Валюта (ISO)</HelpText><Input aria-label="Валюта (ISO)" name="currency" maxLength={3} pattern="[A-Z]{3}|" placeholder="UAH / USD / EUR" defaultValue={filters.currency} /></label>
              <FreelancehuntSelect name="state" label="Стан" defaultValue={filters.state} disabled={busy} options={[{ value: "all", label: "Усі видимі" }, { value: "new", label: "Нові (не переглянуті)" }, { value: "viewed", label: "Переглянуті" }, { value: "saved", label: "Збережені" }, { value: "hidden", label: "Приховані" }]} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-field"><HelpText help="У назві або описі мають бути всі вказані слова чи фрази. Розділяйте комами; регістр не враховується.">Містить слова</HelpText><Input aria-label="Містить усі слова / фрази (через кому)" name="include" maxLength={3000} placeholder="React, інтернет-магазин" defaultValue={filters.include.join(", ")} /></label>
              <label className="form-field"><HelpText help="Відсікає проєкти, у назві чи описі яких є хоча б одне з указаних слів або фраз. Розділяйте комами.">Виключити слова</HelpText><Input aria-label="Без слів / фраз (через кому)" name="exclude" maxLength={3000} placeholder="WordPress, терміново" defaultValue={filters.exclude.join(", ")} /></label>
              <FreelancehuntMultiselect name="skillIds" label="Навички" placeholder="Будь-які навички" options={skills.map(skill => ({ value: String(skill.id), label: skill.name, group: skill.groupName }))} defaultValue={filters.skillIds.map(String)} limit={50} disabled={busy} loading={catalogueLoading} />
              <FreelancehuntMultiselect name="categories" label="Категорії" placeholder="Будь-які категорії" options={categories.map(name => ({ value: name, label: name }))} defaultValue={filters.categories} limit={30} disabled={busy} loading={catalogueLoading} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="form-field"><HelpText>Опубліковано з (UTC)</HelpText><Input aria-label="Опубліковано з (UTC)" type="date" name="from" defaultValue={filters.from} /></label>
              <label className="form-field"><HelpText>Опубліковано до (UTC)</HelpText><Input aria-label="Опубліковано до (UTC)" type="date" name="to" defaultValue={filters.to} /></label>
              <FreelancehuntSelect name="workflow" label="Робочий статус" defaultValue={filters.workflow} options={[{ value: "all", label: "Усі статуси" }, ...Object.entries(projectWorkflows).map(([value, label]) => ({ value, label }))]} />
              <FreelancehuntSelect name="sort" label="Сортування" defaultValue={filters.sort} disabled={busy} options={[{ value: "date", label: "Дата публікації ↓" }, { value: "budget", label: "Валюта ↑, бюджет ↓" }]} />
            </div>
          </fieldset>
          <p className="text-xs leading-6 text-muted-foreground">Особисті фільтри відбирають зібрані проєкти й майбутні особисті сповіщення. Telegram використовує правила спільного каналу. Валюти не конвертуються.</p>
          {catalogueError && <p role="status" className="text-sm text-muted-foreground">{catalogueError}</p>}
          {!workspace.catalogueReady && <p className="text-xs text-muted-foreground">Категорії старих проєктів з’являться після оновлення каталогу.</p>}
          <div className="grid gap-3 border-t pt-5 sm:flex sm:flex-wrap"><Button type="submit" disabled={busy}>{busy ? "Зберігаємо…" : "Застосувати й зберегти"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void action(async () => { await request("workspace", "PUT", { filters: emptyProjectFilters }); setFilterReset(value => value + 1); router.push("/dashboard?tab=freelancehunt"); })}>Скинути фільтри</Button></div>
          <div className="grid items-end gap-3 rounded-xl bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-4">
            <label className="form-field"><HelpText help="Збережіть поточні умови як особистий набір. Повторне збереження тієї самої назви оновлює набір.">Назва набору</HelpText><Input aria-label="Назва нового набору" name="presetName" maxLength={100} placeholder="Наприклад, React-проєкти" /></label><Button type="submit" name="intent" value="preset" variant="outline" disabled={busy}>Зберегти набір</Button>
          </div>
        </form>{message && <p role="status" className="text-sm">{message}</p>}
      </div>
    </details>
    <div className="absolute top-3 right-3 sm:right-5"><ProjectViewToggle initialView={initialView} /></div>
  </div>;
}
