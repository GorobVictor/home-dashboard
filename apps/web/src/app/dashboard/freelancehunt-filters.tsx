"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { getFreelancehuntWorkspace } from "@home-dashboard/database";
import type { FreelancehuntSkill } from "@home-dashboard/integrations";
import { emptyProjectFilters, parseProjectFilters, parseScoringProfile, type ProjectFilters } from "@home-dashboard/integrations/freelancehunt-rules";
import { FreelancehuntScoringEditor } from "@/components/freelancehunt-scoring-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadFreelancehuntCatalogue } from "./freelancehunt-catalogue";
import { FreelancehuntMultiselect } from "./freelancehunt-multiselect";
import { FreelancehuntSelect } from "./freelancehunt-select";

type Workspace = Awaited<ReturnType<typeof getFreelancehuntWorkspace>>;
const split = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
function formFilters(form: HTMLFormElement): ProjectFilters {
  const data = new FormData(form);
  const amount = (key: string) => data.get(key) === "" ? null : Number(data.get(key));
  return parseProjectFilters({ minBudget: amount("minBudget"), maxBudget: amount("maxBudget"), currency: data.get("currency"), skillIds: data.getAll("skillIds").map(Number), categories: data.getAll("categories").map(String), include: split(data.get("include")), exclude: split(data.get("exclude")), from: data.get("from"), to: data.get("to"), minScore: Number(data.get("minScore")), maxScore: Number(data.get("maxScore")), state: data.get("state"), sort: data.get("sort") });
}
export function FreelancehuntFilters({ workspace }: { workspace: Workspace }) {
  const router = useRouter(), filters = workspace.filters;
  const [scoring, setScoring] = useState(workspace.scoring);
  const [presetId, setPresetId] = useState("");
  const [filterReset, setFilterReset] = useState(0);
  const [skills, setSkills] = useState<FreelancehuntSkill[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadFreelancehuntCatalogue().then((skills) => { if (active) setSkills(skills); }).catch(() => { if (active) setCatalogueError("Каталог навичок недоступний. Збережений вибір залишається активним."); });
    return () => { active = false; };
  }, []);
  async function request(path: string, method: string, body?: object) {
    const response = await fetch(`/api/freelancehunt/${path}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("Не вдалося зберегти. Перевірте значення та повторіть спробу.");
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await run(); router.refresh(); } catch (error) { setMessage(error instanceof Error && error.message !== "invalid_input" ? error.message : "Перевірте фільтри та правила скорингу."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await action(async () => {
      const filters = formFilters(form), profile = parseScoringProfile(scoring);
      const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (intent === "preset") {
        const name = String(data.get("presetName") ?? "").trim();
        if (!name) throw new Error("Вкажіть назву пресету.");
        await request("presets", "POST", { name, filters, scoring: profile });
        setMessage("Пресет збережено. Однакова назва оновлює наявний пресет.");
      } else {
        await request("workspace", "PUT", { filters, scoring: profile, notificationMinScore: Number(data.get("notificationMinScore")) });
        router.push("/dashboard?tab=freelancehunt");
        setMessage("Фільтри та правила збережено.");
      }
    });
  }
  const categories = [...new Set([...skills.map((s) => s.groupName), ...filters.categories])].sort((a, b) => a.localeCompare(b, "uk"));
  return <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer font-medium">Фільтри, пресети та релевантність</summary>
    <div className="mt-4 flex flex-wrap items-end gap-2"><FreelancehuntSelect label="Пресет" className="w-full sm:w-72" value={presetId} onValueChange={setPresetId} disabled={busy || !workspace.presets.length} options={[{ value: "", label: workspace.presets.length ? "Оберіть пресет" : "Пресетів ще немає" }, ...workspace.presets.map((preset) => ({ value: preset.id, label: preset.name }))]} /><Button className="h-10" type="button" variant="outline" disabled={busy || !presetId} onClick={() => void action(async () => { const preset = workspace.presets.find((p) => p.id === presetId)!; await request("workspace", "PUT", { filters: preset.filters, scoring: preset.scoring }); router.push("/dashboard?tab=freelancehunt"); })}>Застосувати</Button><Button className="h-10" type="button" variant="ghost" disabled={busy || !presetId} onClick={() => void action(async () => { await request(`presets/${presetId}`, "DELETE"); setPresetId(""); })}>Видалити</Button></div>
    <form key={filterReset} className="mt-4 space-y-5" onSubmit={(event) => void submit(event)}><fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Бюджет від</span><Input className="block h-10" name="minBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.minBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Бюджет до</span><Input className="block h-10" name="maxBudget" type="number" min={0} max={1e12} step="any" defaultValue={filters.maxBudget ?? ""} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Валюта (ISO)</span><Input className="block h-10" name="currency" maxLength={3} pattern="[A-Z]{3}|" placeholder="Усі / UAH / USD" defaultValue={filters.currency} /></label>
      <FreelancehuntSelect name="state" label="Стан" defaultValue={filters.state} disabled={busy} options={[{ value: "all", label: "Усі видимі" }, { value: "new", label: "Нові (непереглянуті)" }, { value: "viewed", label: "Переглянуті" }, { value: "saved", label: "Збережені" }, { value: "hidden", label: "Приховані" }]} />
      <label className="flex min-w-0 flex-col gap-2 text-sm sm:col-span-2"><span className="font-medium">Містить усі слова / фрази (через кому)</span><Input className="block h-10" name="include" maxLength={3000} defaultValue={filters.include.join(", ")} /></label><label className="flex min-w-0 flex-col gap-2 text-sm sm:col-span-2"><span className="font-medium">Виключає будь-яке слово / фразу (через кому)</span><Input className="block h-10" name="exclude" maxLength={3000} defaultValue={filters.exclude.join(", ")} /></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Публікація від (UTC)</span><Input className="block h-10" type="date" name="from" defaultValue={filters.from} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Публікація до (UTC)</span><Input className="block h-10" type="date" name="to" defaultValue={filters.to} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Оцінка від</span><Input className="block h-10" name="minScore" type="number" min={0} max={100} required defaultValue={filters.minScore} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="font-medium">Оцінка до</span><Input className="block h-10" name="maxScore" type="number" min={0} max={100} required defaultValue={filters.maxScore} /></label>
      <FreelancehuntMultiselect name="skillIds" label="Навички" placeholder="Будь-які навички" options={skills.map((skill) => ({ value: String(skill.id), label: skill.name, group: skill.groupName }))} defaultValue={filters.skillIds.map(String)} limit={50} disabled={busy} loading={!skills.length && !catalogueError} />
      <FreelancehuntMultiselect name="categories" label="Категорії" placeholder="Будь-які категорії" options={categories.map((name) => ({ value: name, label: name }))} defaultValue={filters.categories} limit={30} disabled={busy} loading={!skills.length && !catalogueError} />
      <FreelancehuntSelect name="sort" label="Сортування" className="sm:col-span-2" defaultValue={filters.sort} disabled={busy} options={[{ value: "date", label: "Дата публікації ↓" }, { value: "relevance", label: "Релевантність ↓" }, { value: "budget", label: "Валюта ↑, бюджет ↓" }]} />
      <label className="flex min-w-0 flex-col gap-2 text-sm sm:col-span-2"><span className="font-medium">Сповіщення мені, якщо оцінка ≥</span><Input className="block h-10" name="notificationMinScore" type="number" min={0} max={100} required defaultValue={workspace.notificationMinScore} /></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">Фільтри працюють зі вже синхронізованими проєктами. Перелік навичок для збору змінюється в Settings. Бюджети різних валют не конвертуються. «Новий» означає ще не переглянутий вами. Поріг сповіщень застосовується лише до майбутніх відкриттів; Telegram має власний профіль у налаштуваннях каналів.</p>
    {catalogueError && <p role="status" className="text-sm text-muted-foreground">{catalogueError}</p>}{!workspace.catalogueReady && <p className="text-xs text-muted-foreground">Категорії та ID старих проєктів заповняться після успішного завантаження каталогу worker.</p>}
    <details><summary className="cursor-pointer text-sm font-medium">Редагувати скоринг</summary><div className="mt-3"><FreelancehuntScoringEditor value={scoring} onChange={setScoring} disabled={busy} /></div></details>
    <div className="flex flex-wrap items-center gap-2"><Button className="h-10" type="submit" disabled={busy}>{busy ? "Збереження…" : "Застосувати й зберегти"}</Button><Button className="h-10" type="button" variant="outline" disabled={busy} onClick={() => void action(async () => { await request("workspace", "PUT", { filters: emptyProjectFilters }); setFilterReset((value) => value + 1); router.push("/dashboard?tab=freelancehunt"); })}>Скинути фільтри</Button><Input aria-label="Назва нового пресету" name="presetName" className="h-10 w-full sm:w-52" maxLength={100} placeholder="Назва пресету" /><Button className="h-10" type="submit" name="intent" value="preset" variant="outline" disabled={busy}>Зберегти пресет</Button></div>
    </form>{message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details>;
}
